import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { formatarDataISO, parseDataISO } from "@/lib/recorrencia";
import { ListaPresenca, type MembroLinha } from "./ListaPresenca";

// ─────────────────────────────────────────────────────────────────────────
// Registro de presença — fluxo "EVENTO primeiro" (mobile-first):
// a semana lista os eventos; ao escolher um, o sistema mostra a(s) equipe(s)
// ESCALADAS nele com seus membros — sem precisar acertar a equipe antes.
// Navegação por querystring: ?ref=YYYY-MM-DD (semana) &eventoId=…
// Líder: vê apenas os eventos onde a própria equipe está escalada.
// Admin/super: vê todos os eventos da semana (inclusive sem escala, com
// aviso e atalho para escalar).
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
  searchParams: Promise<{ ref?: string; eventoId?: string; equipeId?: string }>;
}) {
  const usuario = await requirePermissao("registrar_presenca_propria");
  const params = await searchParams;
  const podeQualquer = can(usuario.nivelAcesso, "registrar_presenca_qualquer");
  const podeEscalar = can(usuario.nivelAcesso, "gerenciar_escalas");

  // Líder sem equipe vinculada.
  if (!podeQualquer && !usuario.equipeId) {
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

  // ── Janela da semana ──────────────────────────────────────────────────
  const hoje = hojeUTC();
  const ref = (params.ref && parseDataISO(params.ref)) || hoje;
  const inicioSemana = domingoDaSemana(ref);
  const fimSemana = new Date(inicioSemana.getTime() + 6 * DIA_MS);

  const refAnterior = new Date(inicioSemana.getTime() - 7 * DIA_MS);
  const refProximo = new Date(inicioSemana.getTime() + 7 * DIA_MS);

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `/presenca?${p.toString()}`;
  };

  // Eventos da semana (exclui cancelados). Líder: só onde a equipe dele está
  // escalada. Admin: todos — inclusive sem escala, para poder corrigir.
  const eventos = await prisma.evento.findMany({
    where: {
      dataEvento: { gte: inicioSemana, lte: fimSemana },
      status: { not: "cancelado" },
      ...(podeQualquer
        ? {}
        : { escalas: { some: { equipeId: usuario.equipeId! } } }),
    },
    include: {
      tipoEvento: { select: { nome: true } },
      escalas: {
        include: {
          equipe: { select: { id: true, nome: true, corHex: true } },
        },
        orderBy: { dataCriacao: "asc" },
      },
      _count: {
        select: { presencas: { where: { excluidoEm: null } } },
      },
    },
    orderBy: [{ dataEvento: "asc" }, { horarioInicio: "asc" }],
  });

  const tituloSemana = `Semana de ${inicioSemana.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })} a ${fimSemana.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}`;

  const navBtn =
    "rounded-lg border border-edge bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-2";

  // ── Evento selecionado → uma lista de presença por equipe escalada ────
  const eventoSelecionado = params.eventoId
    ? eventos.find((e) => e.id === params.eventoId)
    : undefined;

  let secoes: {
    equipe: { id: string; nome: string; corHex: string | null };
    membros: MembroLinha[];
  }[] = [];

  if (eventoSelecionado) {
    // Líder lança apenas a própria equipe (o servidor valida de novo na action).
    const equipesDoEvento = eventoSelecionado.escalas
      .map((esc) => esc.equipe)
      .filter((eq) => podeQualquer || eq.id === usuario.equipeId);
    const equipeIds = equipesDoEvento.map((eq) => eq.id);

    if (equipeIds.length > 0) {
      const [membros, presencas] = await Promise.all([
        prisma.membro.findMany({
          where: { equipeId: { in: equipeIds }, status: "ativo" },
          orderBy: { nomeCompleto: "asc" },
          select: { id: true, nomeCompleto: true, equipeId: true },
        }),
        prisma.presenca.findMany({
          where: { eventoId: eventoSelecionado.id, equipeId: { in: equipeIds } },
          orderBy: { dataRegistro: "asc" },
        }),
      ]);

      secoes = equipesDoEvento.map((eq) => ({
        equipe: eq,
        membros: membros
          .filter((m) => m.equipeId === eq.id)
          .map((m) => {
            const doMembro = presencas.filter(
              (p) => p.membroId === m.id && p.equipeId === eq.id,
            );
            const ativo = doMembro.find((p) => p.excluidoEm === null) ?? null;
            const excluido =
              doMembro
                .filter((p) => p.excluidoEm !== null)
                .sort(
                  (a, b) =>
                    (b.excluidoEm?.getTime() ?? 0) -
                    (a.excluidoEm?.getTime() ?? 0),
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
          }),
      }));
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-ink">Registrar Presença</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Escolha o evento — o sistema mostra a(s) equipe(s) escalada(s) e seus
          membros.
          {!podeQualquer && usuario.equipeNome
            ? ` Sua equipe: ${usuario.equipeNome}.`
            : ""}
        </p>
      </header>

      {eventoSelecionado ? (
        // ── Lançamento do evento selecionado ───────────────────────────
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
          </div>

          {eventoSelecionado.escalas.length === 0 ? (
            // Nenhuma equipe escalada: sinaliza e oferece a correção.
            <div className="rounded-2xl border border-warn-edge bg-warn-faint p-6 text-sm text-warn-text">
              <p className="font-semibold">
                Nenhuma equipe escalada neste evento.
              </p>
              <p className="mt-1">
                Sem escala não há quem convocar — escale uma equipe para liberar
                o registro de presença.
              </p>
              {podeEscalar ? (
                <Link
                  href={`/eventos/${eventoSelecionado.id}`}
                  className="mt-3 inline-block rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong"
                >
                  Escalar equipe
                </Link>
              ) : (
                <p className="mt-2 text-xs">
                  Peça a um administrador para escalar a equipe.
                </p>
              )}
            </div>
          ) : secoes.length === 0 ? (
            // Líder cujo time não está escalado neste evento (via link direto).
            <div className="rounded-2xl border border-warn-edge bg-warn-faint p-6 text-sm text-warn-text">
              Sua equipe não está escalada neste evento.
            </div>
          ) : (
            secoes.map((s) => (
              <ListaPresenca
                key={s.equipe.id}
                eventoId={eventoSelecionado.id}
                equipeId={s.equipe.id}
                equipeNome={s.equipe.nome}
                corHex={s.equipe.corHex}
                horarioChegadaSugerido={eventoSelecionado.horarioChegadaEquipe}
                membros={s.membros}
              />
            ))
          )}
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
              Atual
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
              {podeQualquer
                ? "Nenhum evento nesta semana. Use as setas para navegar entre as semanas."
                : `Nenhum evento com a equipe ${usuario.equipeNome ?? ""} escalada nesta semana. Use as setas para navegar.`}
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
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {e.escalas.length === 0 && (
                          <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn-text">
                            Sem equipe escalada
                          </span>
                        )}
                        {e.escalas.map((esc) => (
                          <span
                            key={esc.id}
                            className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink-soft"
                          >
                            <span
                              className="h-2 w-2 rounded-full border border-edge-soft"
                              style={{
                                backgroundColor: esc.equipe.corHex ?? "#a1a1aa",
                              }}
                              aria-hidden
                            />
                            {esc.equipe.nome}
                          </span>
                        ))}
                      </div>
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
