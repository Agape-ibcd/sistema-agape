import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { formatarDataISO, parseDataISO } from "@/lib/recorrencia";
import { AcoesEventos } from "./AcoesEventos";

// ─────────────────────────────────────────────────────────────────────────
// Calendário de eventos e escalas (visões mês e semana).
// Cada evento mostra as equipes escaladas com a cor da equipe.
// Navegação por querystring: ?visao=mes|semana&ref=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────

const DIA_MS = 86_400_000;
const NOMES_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function hojeUTC(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
}

function domingoDaSemana(d: Date): Date {
  return new Date(d.getTime() - d.getUTCDay() * DIA_MS);
}

type EventoDoDia = {
  id: string;
  horarioInicio: string;
  horarioChegadaEquipe: string;
  nome: string;
  status: string;
  escalas: { equipeNome: string; corHex: string | null; tipoEscala: string }[];
};

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string; ref?: string }>;
}) {
  // Leitura basta para ver o calendário (nível monitor); os controles de
  // escrita abaixo são condicionados às permissões específicas.
  const usuario = await requirePermissao("ver_calendario");
  const params = await searchParams;

  const hoje = hojeUTC();
  const ref = (params.ref && parseDataISO(params.ref)) || hoje;
  const visao = params.visao === "semana" ? "semana" : "mes";

  // Janela visível (grade completa do mês inclui pontas das semanas vizinhas).
  let inicioJanela: Date;
  let fimJanela: Date;
  if (visao === "mes") {
    const primeiroDia = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
    const ultimoDia = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
    inicioJanela = domingoDaSemana(primeiroDia);
    fimJanela = new Date(
      domingoDaSemana(ultimoDia).getTime() + 6 * DIA_MS,
    );
  } else {
    inicioJanela = domingoDaSemana(ref);
    fimJanela = new Date(inicioJanela.getTime() + 6 * DIA_MS);
  }

  const eventos = await prisma.evento.findMany({
    where: { dataEvento: { gte: inicioJanela, lte: fimJanela } },
    include: {
      tipoEvento: { select: { nome: true } },
      escalas: {
        include: { equipe: { select: { nome: true, corHex: true } } },
        orderBy: { dataCriacao: "asc" },
      },
    },
    orderBy: [{ dataEvento: "asc" }, { horarioInicio: "asc" }],
  });

  // Agrupa por dia (chave ISO).
  const porDia = new Map<string, EventoDoDia[]>();
  for (const e of eventos) {
    const chave = formatarDataISO(e.dataEvento);
    const lista = porDia.get(chave) ?? [];
    lista.push({
      id: e.id,
      horarioInicio: e.horarioInicio,
      horarioChegadaEquipe: e.horarioChegadaEquipe,
      nome: e.descricaoEspecifica ?? e.tipoEvento.nome,
      status: e.status,
      escalas: e.escalas.map((esc) => ({
        equipeNome: esc.equipe.nome,
        corHex: esc.equipe.corHex,
        tipoEscala: esc.tipoEscala,
      })),
    });
    porDia.set(chave, lista);
  }

  // Navegação anterior/próximo.
  const passo = visao === "mes" ? "mes" : "semana";
  const refAnterior =
    passo === "mes"
      ? new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - 1, 1))
      : new Date(ref.getTime() - 7 * DIA_MS);
  const refProximo =
    passo === "mes"
      ? new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1))
      : new Date(ref.getTime() + 7 * DIA_MS);

  const urlCal = (v: string, r: Date) => `/eventos?visao=${v}&ref=${formatarDataISO(r)}`;

  const tituloPeriodo =
    visao === "mes"
      ? ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
      : `Semana de ${inicioJanela.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })} a ${fimJanela.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}`;

  // Dias da grade.
  const dias: Date[] = [];
  for (let d = inicioJanela; d.getTime() <= fimJanela.getTime(); d = new Date(d.getTime() + DIA_MS)) {
    dias.push(d);
  }

  const podeGerirTipos = can(usuario.nivelAcesso, "gerenciar_tipos_evento");
  const podeEventoExtra = can(usuario.nivelAcesso, "criar_eventos_extras");
  const podeGerirEscalas = can(usuario.nivelAcesso, "gerenciar_escalas");

  const navBtn =
    "rounded-lg border border-edge bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-2";

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-display font-semibold uppercase tracking-wide text-ink">Eventos e Escalas</h1>
          <div className="flex flex-wrap items-center gap-2">
            {podeEventoExtra && (
              <Link
                href="/eventos/novo"
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-strong"
              >
                + Evento avulso
              </Link>
            )}
            <AcoesEventos
              podeGerirEscalas={podeGerirEscalas}
              podeGerirTipos={podeGerirTipos}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={urlCal(visao, refAnterior)} className={navBtn} aria-label="Anterior">
            ←
          </Link>
          <Link href={urlCal(visao, hoje)} className={navBtn}>
            Hoje
          </Link>
          <Link href={urlCal(visao, refProximo)} className={navBtn} aria-label="Próximo">
            →
          </Link>
          <span className="ml-1 text-sm font-semibold capitalize text-ink">
            {tituloPeriodo}
          </span>
          <span className="flex-1" />
          <nav className="flex overflow-hidden rounded-lg border border-edge">
            <Link
              href={urlCal("mes", ref)}
              className={`px-3 py-1.5 text-sm font-medium ${visao === "mes" ? "bg-brand text-white" : "bg-surface text-ink-soft hover:bg-surface-2"}`}
            >
              Mês
            </Link>
            <Link
              href={urlCal("semana", ref)}
              className={`px-3 py-1.5 text-sm font-medium ${visao === "semana" ? "bg-brand text-white" : "bg-surface text-ink-soft hover:bg-surface-2"}`}
            >
              Semana
            </Link>
          </nav>
        </div>
      </header>

      {visao === "mes" ? (
        <>
          {/* Grade mensal (desktop/tablet) */}
          <div className="hidden overflow-hidden rounded-2xl border border-edge-soft vidro-leve sm:block">
            <div className="grid grid-cols-7 border-b border-edge-soft bg-surface-2">
              {NOMES_DIAS.map((n) => (
                <div key={n} className="px-2 py-2 text-center text-xs font-semibold text-ink-soft">
                  {n}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {dias.map((d) => {
                const chave = formatarDataISO(d);
                const doDia = porDia.get(chave) ?? [];
                const mesAtual = d.getUTCMonth() === ref.getUTCMonth();
                const ehHoje = chave === formatarDataISO(hoje);
                return (
                  <div
                    key={chave}
                    className={`min-h-24 border-b border-r border-edge-soft p-1.5 ${mesAtual ? "" : "bg-surface-2/60"}`}
                  >
                    <p
                      className={`mb-1 text-right text-xs font-medium ${
                        ehHoje
                          ? "ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white"
                          : mesAtual
                            ? "text-ink-soft"
                            : "text-ink-faint"
                      }`}
                    >
                      {d.getUTCDate()}
                    </p>
                    <div className="space-y-1">
                      {doDia.map((e) => (
                        <ChipEvento key={e.id} evento={e} compacto />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lista mensal (celular): só dias com evento */}
          <div className="space-y-3 sm:hidden">
            {dias
              .filter((d) => (porDia.get(formatarDataISO(d)) ?? []).length > 0)
              .map((d) => (
                <DiaLista
                  key={formatarDataISO(d)}
                  dia={d}
                  eventos={porDia.get(formatarDataISO(d)) ?? []}
                  ehHoje={formatarDataISO(d) === formatarDataISO(hoje)}
                />
              ))}
            {eventos.length === 0 && <VazioCalendario />}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {dias.map((d) => (
            <DiaLista
              key={formatarDataISO(d)}
              dia={d}
              eventos={porDia.get(formatarDataISO(d)) ?? []}
              ehHoje={formatarDataISO(d) === formatarDataISO(hoje)}
            />
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-ink-subtle">
        As cores indicam as equipes escaladas. Toque num evento para{" "}
        {podeGerirEscalas ? "gerir a escala" : "ver os detalhes"}.
      </p>
    </div>
  );
}

function ChipEvento({ evento, compacto }: { evento: EventoDoDia; compacto?: boolean }) {
  const cancelado = evento.status === "cancelado";
  return (
    <Link
      href={`/eventos/${evento.id}`}
      className={`block rounded-lg border border-edge-soft px-1.5 py-1 text-xs transition hover:border-brand-edge hover:bg-brand-faint ${cancelado ? "opacity-50" : ""}`}
    >
      <p className={`truncate font-medium text-ink ${cancelado ? "line-through" : ""}`}>
        {evento.horarioInicio} {evento.nome}
      </p>
      {evento.escalas.length > 0 && (
        <span className="mt-0.5 flex flex-wrap gap-1">
          {evento.escalas.map((esc, i) => (
            <span
              key={i}
              title={`${esc.equipeNome}${esc.tipoEscala === "cobertura" ? " (cobertura semanal)" : esc.tipoEscala === "especial" ? " (especial)" : ""}`}
              className="inline-block h-2 w-2 rounded-full border border-edge-soft"
              style={{ backgroundColor: esc.corHex ?? "#a1a1aa" }}
            />
          ))}
        </span>
      )}
      {!compacto && evento.escalas.length === 0 && !cancelado && (
        <p className="text-[11px] text-warn-text">Sem equipe escalada</p>
      )}
    </Link>
  );
}

function DiaLista({
  dia,
  eventos,
  ehHoje,
}: {
  dia: Date;
  eventos: EventoDoDia[];
  ehHoje: boolean;
}) {
  return (
    <section className="rounded-2xl border border-edge-soft vidro-leve p-3">
      <h2 className="mb-2 text-sm font-semibold text-ink">
        {ehHoje && (
          <span className="mr-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
            Hoje
          </span>
        )}
        {dia.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          timeZone: "UTC",
        })}
      </h2>
      {eventos.length === 0 ? (
        <p className="text-xs text-ink-faint">Sem eventos.</p>
      ) : (
        <div className="space-y-2">
          {eventos.map((e) => (
            <Link
              key={e.id}
              href={`/eventos/${e.id}`}
              className={`block rounded-xl border border-edge-soft p-3 transition hover:border-brand-edge hover:bg-brand-faint ${e.status === "cancelado" ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`text-sm font-medium text-ink ${e.status === "cancelado" ? "line-through" : ""}`}
                >
                  {e.nome}
                </p>
                <p className="text-sm font-semibold text-ink-soft">{e.horarioInicio}</p>
              </div>
              <p className="mt-0.5 text-xs text-ink-subtle">
                Chegada da equipe: {e.horarioChegadaEquipe}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {e.escalas.length === 0 && e.status !== "cancelado" && (
                  <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn-text">
                    Sem equipe escalada
                  </span>
                )}
                {e.escalas.map((esc, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink-soft"
                  >
                    <span
                      className="h-2 w-2 rounded-full border border-edge-soft"
                      style={{ backgroundColor: esc.corHex ?? "#a1a1aa" }}
                    />
                    {esc.equipeNome}
                    {esc.tipoEscala !== "regular" && (
                      <span className="text-ink-faint">
                        · {esc.tipoEscala === "cobertura" ? "cobertura" : "especial"}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function VazioCalendario() {
  return (
    <div className="rounded-2xl border border-dashed border-edge bg-surface p-8 text-center text-sm text-ink-subtle">
      Nenhum evento neste período. Gere as instâncias em{" "}
      <Link href="/eventos/tipos" className="text-brand-text underline">
        Tipos de evento
      </Link>
      .
    </div>
  );
}
