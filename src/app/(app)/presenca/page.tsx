import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { formatarDataISO, parseDataISO } from "@/lib/recorrencia";
import { SeletorEquipe } from "./SeletorEquipe";
import { ListaPresenca, type MembroLinha } from "./ListaPresenca";

// ─────────────────────────────────────────────────────────────────────────
// Registro de presença (Etapa 4) — mobile-first.
// Navegação por querystring: ?ref=YYYY-MM-DD (semana) &equipeId=… &eventoId=…
// Líder: travado na própria equipe. Admin/super_admin: escolhe a equipe.
// ─────────────────────────────────────────────────────────────────────────

const DIA_MS = 86_400_000;

function hojeUTC(): Date {
  const agora = new Date();
  return new Date(
    Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()),
  );
}

function domingoDaSemana(d: Date): Date {
  return new Date(d.getTime() - d.getUTCDay() * DIA_MS);
}

export default async function PresencaPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; equipeId?: string; eventoId?: string }>;
}) {
  const usuario = await requirePermissao("registrar_presenca_propria");
  const params = await searchParams;
  const podeQualquer = can(usuario.nivelAcesso, "registrar_presenca_qualquer");

  // ── Equipe em foco ───────────────────────────────────────────────────
  let equipes: { id: string; nome: string }[] = [];
  let equipeIdFoco: string | null = null;

  if (podeQualquer) {
    equipes = await prisma.equipe.findMany({
      where: { status: "ativa" },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    });
    const pedido = params.equipeId;
    if (pedido && equipes.some((e) => e.id === pedido)) {
      equipeIdFoco = pedido;
    } else if (usuario.equipeId && equipes.some((e) => e.id === usuario.equipeId)) {
      equipeIdFoco = usuario.equipeId;
    } else {
      equipeIdFoco = equipes[0]?.id ?? null;
    }
  } else {
    // Líder: sempre a própria equipe, sem seletor.
    equipeIdFoco = usuario.equipeId;
  }

  // Líder sem equipe vinculada.
  if (!podeQualquer && !equipeIdFoco) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-ink">Registrar Presença</h1>
        <div className="mt-6 rounded-2xl border border-warn-edge bg-warn-faint p-6 text-sm text-warn-text">
          Você não está vinculado a uma equipe. Peça a um administrador para
          associar seu cadastro a uma equipe antes de registrar presenças.
        </div>
      </div>
    );
  }

  // Admin sem nenhuma equipe ativa cadastrada.
  if (!equipeIdFoco) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-ink">Registrar Presença</h1>
        <div className="mt-6 rounded-2xl border border-warn-edge bg-warn-faint p-6 text-sm text-warn-text">
          Nenhuma equipe ativa cadastrada.
        </div>
      </div>
    );
  }

  const equipeNomeFoco =
    equipes.find((e) => e.id === equipeIdFoco)?.nome ??
    usuario.equipeNome ??
    "";

  // ── Janela da semana ──────────────────────────────────────────────────
  const hoje = hojeUTC();
  const ref = (params.ref && parseDataISO(params.ref)) || hoje;
  const inicioSemana = domingoDaSemana(ref);
  const fimSemana = new Date(inicioSemana.getTime() + 6 * DIA_MS);

  const refAnterior = new Date(inicioSemana.getTime() - 7 * DIA_MS);
  const refProximo = new Date(inicioSemana.getTime() + 7 * DIA_MS);

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (podeQualquer && equipeIdFoco) p.set("equipeId", equipeIdFoco);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `/presenca?${p.toString()}`;
  };

  // Eventos da semana onde a equipe em foco está escalada (exclui cancelados).
  const eventos = await prisma.evento.findMany({
    where: {
      dataEvento: { gte: inicioSemana, lte: fimSemana },
      status: { not: "cancelado" },
      escalas: { some: { equipeId: equipeIdFoco } },
    },
    include: {
      tipoEvento: { select: { nome: true } },
      escalas: { include: { equipe: { select: { nome: true } } } },
      _count: {
        select: {
          presencas: { where: { excluidoEm: null, equipeId: equipeIdFoco } },
        },
      },
    },
    orderBy: [{ dataEvento: "asc" }, { horarioInicio: "asc" }],
  });

  const tituloSemana = `Semana de ${inicioSemana.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })} a ${fimSemana.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}`;

  const navBtn =
    "rounded-lg border border-edge bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-2";

  // ── Evento selecionado → lista de presença ────────────────────────────
  const eventoSelecionado = params.eventoId
    ? eventos.find((e) => e.id === params.eventoId)
    : undefined;

  let membrosLinha: MembroLinha[] = [];
  if (eventoSelecionado) {
    const [membros, presencas] = await Promise.all([
      prisma.membro.findMany({
        where: { equipeId: equipeIdFoco, status: "ativo" },
        orderBy: { nomeCompleto: "asc" },
        select: { id: true, nomeCompleto: true },
      }),
      prisma.presenca.findMany({
        where: { eventoId: eventoSelecionado.id, equipeId: equipeIdFoco },
        orderBy: { dataRegistro: "asc" },
      }),
    ]);

    membrosLinha = membros.map((m) => {
      const doMembro = presencas.filter((p) => p.membroId === m.id);
      const ativo = doMembro.find((p) => p.excluidoEm === null) ?? null;
      // Excluído mais recente (só relevante quando não há ativo).
      const excluido =
        doMembro
          .filter((p) => p.excluidoEm !== null)
          .sort(
            (a, b) =>
              (b.excluidoEm?.getTime() ?? 0) - (a.excluidoEm?.getTime() ?? 0),
          )[0] ?? null;

      return {
        id: m.id,
        nome: m.nomeCompleto,
        ativo: ativo
          ? {
              id: ativo.id,
              presente: ativo.presente,
              pontualidade: ativo.pontualidade,
              horarioChegada: ativo.horarioChegada,
              justificativaAusencia: ativo.justificativaAusencia,
            }
          : null,
        excluido:
          !ativo && excluido
            ? {
                id: excluido.id,
                presente: excluido.presente,
                pontualidade: excluido.pontualidade,
                motivoExclusao: excluido.motivoExclusao,
              }
            : null,
      };
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-ink">Registrar Presença</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Equipe: <span className="font-medium text-ink">{equipeNomeFoco}</span>
        </p>
      </header>

      {/* Seletor de equipe (admin) */}
      {podeQualquer && equipes.length > 0 && (
        <div className="mb-4 max-w-xs">
          <SeletorEquipe equipes={equipes} equipeIdAtual={equipeIdFoco} />
        </div>
      )}

      {eventoSelecionado ? (
        // ── Lista de presença de um evento ─────────────────────────────
        <div className="space-y-4">
          <Link
            href={qs({ ref: formatarDataISO(inicioSemana) })}
            className="text-sm text-brand-text hover:underline"
          >
            ← Voltar aos eventos da semana
          </Link>

          <div className="rounded-2xl border border-edge-soft bg-surface p-4">
            <p className="text-sm font-semibold text-ink">
              {eventoSelecionado.descricaoEspecifica ??
                eventoSelecionado.tipoEvento.nome}
            </p>
            <p className="mt-0.5 text-xs text-ink-subtle">
              {eventoSelecionado.dataEvento.toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                timeZone: "UTC",
              })}
              {" · "}
              Início {eventoSelecionado.horarioInicio} · Chegada{" "}
              {eventoSelecionado.horarioChegadaEquipe}
            </p>
            {eventoSelecionado.escalas.length > 1 && (
              <p className="mt-2 rounded-lg bg-info-faint px-3 py-2 text-xs text-info-text">
                Este evento tem mais de uma equipe escalada. Você está lançando a
                presença da equipe <strong>{equipeNomeFoco}</strong>.
              </p>
            )}
          </div>

          <ListaPresenca
            eventoId={eventoSelecionado.id}
            equipeId={equipeIdFoco}
            horarioChegadaSugerido={eventoSelecionado.horarioChegadaEquipe}
            membros={membrosLinha}
          />
        </div>
      ) : (
        // ── Lista de eventos da semana ─────────────────────────────────
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Link
              href={qs({ ref: formatarDataISO(refAnterior) })}
              className={navBtn}
              aria-label="Semana anterior"
            >
              ←
            </Link>
            <Link href={qs({ ref: formatarDataISO(hoje) })} className={navBtn}>
              Hoje
            </Link>
            <Link
              href={qs({ ref: formatarDataISO(refProximo) })}
              className={navBtn}
              aria-label="Próxima semana"
            >
              →
            </Link>
            <span className="ml-1 text-sm font-semibold text-ink">
              {tituloSemana}
            </span>
          </div>

          {eventos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-edge bg-surface p-8 text-center text-sm text-ink-subtle">
              Nenhum evento da equipe {equipeNomeFoco} nesta semana. Use as setas
              para navegar entre as semanas.
            </div>
          ) : (
            <ul className="space-y-2">
              {eventos.map((e) => {
                const ehHoje =
                  formatarDataISO(e.dataEvento) === formatarDataISO(hoje);
                return (
                  <li key={e.id}>
                    <Link
                      href={qs({
                        ref: formatarDataISO(inicioSemana),
                        eventoId: e.id,
                      })}
                      className={`block rounded-2xl border bg-surface p-4 transition hover:border-brand-edge hover:bg-brand-faint ${ehHoje ? "border-brand-edge ring-1 ring-brand-ring" : "border-edge-soft"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink">
                          {ehHoje && (
                            <span className="mr-2 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">
                              Hoje
                            </span>
                          )}
                          {e.descricaoEspecifica ?? e.tipoEvento.nome}
                        </p>
                        <p className="text-sm font-semibold text-ink-soft">
                          {e.horarioInicio}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-ink-subtle">
                        {e.dataEvento.toLocaleDateString("pt-BR", {
                          weekday: "long",
                          day: "2-digit",
                          month: "2-digit",
                          timeZone: "UTC",
                        })}
                        {" · "}
                        {e._count.presencas > 0
                          ? `${e._count.presencas} presença(s) lançada(s)`
                          : "sem lançamentos"}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
