import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { formatarDataISO, parseDataISO } from "@/lib/recorrencia";

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
  const usuario = await requirePermissao("gerenciar_escalas");
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

  const navBtn =
    "rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50";

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-zinc-900">Eventos e Escalas</h1>
          <div className="flex flex-wrap gap-2">
            {podeGerirTipos && (
              <Link href="/eventos/tipos" className={navBtn}>
                Tipos de evento
              </Link>
            )}
            {podeEventoExtra && (
              <Link
                href="/eventos/novo"
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                + Evento avulso
              </Link>
            )}
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
          <span className="ml-1 text-sm font-semibold capitalize text-zinc-800">
            {tituloPeriodo}
          </span>
          <span className="flex-1" />
          <nav className="flex overflow-hidden rounded-lg border border-zinc-300">
            <Link
              href={urlCal("mes", ref)}
              className={`px-3 py-1.5 text-sm font-medium ${visao === "mes" ? "bg-emerald-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"}`}
            >
              Mês
            </Link>
            <Link
              href={urlCal("semana", ref)}
              className={`px-3 py-1.5 text-sm font-medium ${visao === "semana" ? "bg-emerald-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"}`}
            >
              Semana
            </Link>
          </nav>
        </div>
      </header>

      {visao === "mes" ? (
        <>
          {/* Grade mensal (desktop/tablet) */}
          <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:block">
            <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
              {NOMES_DIAS.map((n) => (
                <div key={n} className="px-2 py-2 text-center text-xs font-semibold text-zinc-600">
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
                    className={`min-h-24 border-b border-r border-zinc-100 p-1.5 ${mesAtual ? "" : "bg-zinc-50/60"}`}
                  >
                    <p
                      className={`mb-1 text-right text-xs font-medium ${
                        ehHoje
                          ? "ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white"
                          : mesAtual
                            ? "text-zinc-700"
                            : "text-zinc-400"
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

      <p className="mt-3 text-xs text-zinc-500">
        As cores indicam as equipes escaladas. Toque num evento para gerir a escala.
      </p>
    </div>
  );
}

function ChipEvento({ evento, compacto }: { evento: EventoDoDia; compacto?: boolean }) {
  const cancelado = evento.status === "cancelado";
  return (
    <Link
      href={`/eventos/${evento.id}`}
      className={`block rounded-lg border border-zinc-200 px-1.5 py-1 text-xs transition hover:border-emerald-300 hover:bg-emerald-50 ${cancelado ? "opacity-50" : ""}`}
    >
      <p className={`truncate font-medium text-zinc-800 ${cancelado ? "line-through" : ""}`}>
        {evento.horarioInicio} {evento.nome}
      </p>
      {evento.escalas.length > 0 && (
        <span className="mt-0.5 flex flex-wrap gap-1">
          {evento.escalas.map((esc, i) => (
            <span
              key={i}
              title={`${esc.equipeNome}${esc.tipoEscala === "cobertura" ? " (cobertura semanal)" : esc.tipoEscala === "especial" ? " (especial)" : ""}`}
              className="inline-block h-2 w-2 rounded-full border border-black/10"
              style={{ backgroundColor: esc.corHex ?? "#a1a1aa" }}
            />
          ))}
        </span>
      )}
      {!compacto && evento.escalas.length === 0 && !cancelado && (
        <p className="text-[11px] text-amber-600">Sem equipe escalada</p>
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
    <section className="rounded-2xl border border-zinc-200 bg-white p-3">
      <h2 className="mb-2 text-sm font-semibold text-zinc-800">
        {ehHoje && (
          <span className="mr-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
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
        <p className="text-xs text-zinc-400">Sem eventos.</p>
      ) : (
        <div className="space-y-2">
          {eventos.map((e) => (
            <Link
              key={e.id}
              href={`/eventos/${e.id}`}
              className={`block rounded-xl border border-zinc-200 p-3 transition hover:border-emerald-300 hover:bg-emerald-50 ${e.status === "cancelado" ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`text-sm font-medium text-zinc-900 ${e.status === "cancelado" ? "line-through" : ""}`}
                >
                  {e.nome}
                </p>
                <p className="text-sm font-semibold text-zinc-700">{e.horarioInicio}</p>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                Chegada da equipe: {e.horarioChegadaEquipe}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {e.escalas.length === 0 && e.status !== "cancelado" && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Sem equipe escalada
                  </span>
                )}
                {e.escalas.map((esc, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
                  >
                    <span
                      className="h-2 w-2 rounded-full border border-black/10"
                      style={{ backgroundColor: esc.corHex ?? "#a1a1aa" }}
                    />
                    {esc.equipeNome}
                    {esc.tipoEscala !== "regular" && (
                      <span className="text-zinc-400">
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
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
      Nenhum evento neste período. Gere as instâncias em{" "}
      <Link href="/eventos/tipos" className="text-emerald-700 underline">
        Tipos de evento
      </Link>
      .
    </div>
  );
}
