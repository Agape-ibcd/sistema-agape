import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { formatarDataISO } from "@/lib/recorrencia";
import { EscalasPanel } from "./EscalasPanel";
import { EventoForm } from "./EventoForm";

const BADGE_STATUS = {
  agendado: ["Agendado", "bg-brand-soft text-brand-text"],
  realizado: ["Realizado", "bg-info-soft text-info-text"],
  cancelado: ["Cancelado", "bg-danger-soft text-danger-text"],
} as const;

export default async function EventoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Leitura basta para ver o evento (nível monitor); escrita fica atrás de
  // `gerenciar_escalas` — validada também nas Server Actions.
  const usuario = await requirePermissao("ver_calendario");
  const podeGerirEscalas = can(usuario.nivelAcesso, "gerenciar_escalas");
  const { id } = await params;

  const [evento, equipesAtivas] = await Promise.all([
    prisma.evento.findUnique({
      where: { id },
      include: {
        tipoEvento: { select: { nome: true } },
        escalas: {
          include: { equipe: { select: { nome: true, corHex: true } } },
          orderBy: { dataCriacao: "asc" },
        },
      },
    }),
    prisma.equipe.findMany({
      where: { status: "ativa" },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, corHex: true },
    }),
  ]);
  if (!evento) notFound();

  const [rotuloStatus, corStatus] = BADGE_STATUS[evento.status];
  const equipesEscaladas = new Set(evento.escalas.map((e) => e.equipeId));
  const equipesDisponiveis = equipesAtivas.filter((e) => !equipesEscaladas.has(e.id));

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <Link
          href={`/eventos?visao=semana&ref=${formatarDataISO(evento.dataEvento)}`}
          className="text-sm text-brand-text hover:underline"
        >
          ← Calendário
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-ink">
            {evento.descricaoEspecifica ?? evento.tipoEvento.nome}
          </h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${corStatus}`}>
            {rotuloStatus}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {evento.dataEvento.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
          {" · "}
          Início {evento.horarioInicio} · Chegada da equipe {evento.horarioChegadaEquipe}
          {evento.descricaoEspecifica ? ` · Tipo: ${evento.tipoEvento.nome}` : ""}
          {evento.geradoAutomaticamente ? " · gerado automaticamente" : ""}
        </p>
      </header>

      <div className="space-y-6">
        <EscalasPanel
          eventoId={evento.id}
          dataEventoISO={formatarDataISO(evento.dataEvento)}
          escalas={evento.escalas.map((e) => ({
            id: e.id,
            equipeNome: e.equipe.nome,
            corHex: e.equipe.corHex,
            tipoEscala: e.tipoEscala,
            origem: e.origem,
            observacao: e.observacao,
          }))}
          equipesDisponiveis={equipesDisponiveis}
          cancelado={evento.status === "cancelado"}
          somenteLeitura={!podeGerirEscalas}
        />

        {podeGerirEscalas && (
          <EventoForm
            evento={{
              id: evento.id,
              horarioInicio: evento.horarioInicio,
              descricaoEspecifica: evento.descricaoEspecifica ?? "",
              status: evento.status,
            }}
          />
        )}
      </div>
    </div>
  );
}
