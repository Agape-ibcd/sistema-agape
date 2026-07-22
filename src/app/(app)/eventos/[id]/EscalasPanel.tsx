"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import {
  escalarEquipe,
  propagarEscala,
  removerEscala,
  trocarEscala,
  definirMembrosEscala,
} from "../actions";
import { FeedbackModal } from "@/components/FeedbackModal";

type MembroEquipe = { id: string; nome: string };

type Escala = {
  id: string;
  equipeNome: string;
  corHex: string | null;
  tipoEscala: "regular" | "especial" | "cobertura";
  origem: "manual" | "rodizio";
  observacao: string | null;
  membrosEquipe: MembroEquipe[];
  convocadosIds: string[]; // vazio = equipe inteira
};

type Props = {
  eventoId: string;
  dataEventoISO: string; // "YYYY-MM-DD" — p/ o atalho de registro de presença
  escalas: Escala[];
  equipesDisponiveis: { id: string; nome: string; corHex: string | null }[];
  cancelado: boolean;
  // Nível monitor: vê a escala, sem os controles de escrita (as Server
  // Actions também validam a permissão no servidor).
  somenteLeitura?: boolean;
};

const ROTULO_TIPO_ESCALA = {
  regular: "Regular",
  especial: "Especial",
  cobertura: "Cobertura semanal",
} as const;

export function EscalasPanel({
  eventoId,
  dataEventoISO,
  escalas,
  equipesDisponiveis,
  cancelado,
  somenteLeitura = false,
}: Props) {
  const [estadoEscalar, escalarAction, pEscalar] = useActionState(escalarEquipe, null);
  const [estadoPropagar, propagarAction, pPropagar] = useActionState(propagarEscala, null);
  const [estadoRemover, removerAction, pRemover] = useActionState(removerEscala, null);
  const [estadoTrocar, trocarAction, pTrocar] = useActionState(trocarEscala, null);
  const [estadoMembros, membrosAction, pMembros] = useActionState(definirMembrosEscala, null);
  // ts da pergunta de propagação já respondida/dispensada.
  const [propagacaoDispensada, setPropagacaoDispensada] = useState<number | null>(null);
  // Escala com o painel "trocar equipe" aberto.
  const [trocandoId, setTrocandoId] = useState<string | null>(null);
  // Escala com o painel "escolher membros" (convocação parcial) aberto.
  const [editandoMembrosId, setEditandoMembrosId] = useState<string | null>(null);

  const inputCls =
    "w-full rounded-xl border border-edge px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";

  // A pergunta fica aberta até o usuário dispensar ("Não") ou a propagação
  // responder (estadoPropagar mais novo que a escalação que gerou a pergunta).
  const propagacaoAberta =
    estadoEscalar?.ok &&
    estadoEscalar.propagacao &&
    estadoEscalar.ts !== propagacaoDispensada &&
    !(estadoPropagar && estadoPropagar.ts > estadoEscalar.ts);

  return (
    <section className="rounded-2xl border border-edge-soft vidro-leve p-5">
      <h2 className="text-base font-semibold text-ink">Escala de equipes</h2>

      <ul className="mt-3 divide-y divide-edge-soft">
        {escalas.length === 0 && (
          <li className="py-3 text-sm text-warn-text">
            Nenhuma equipe escalada neste evento.
          </li>
        )}
        {escalas.map((e) => (
          <li key={e.id} className="py-2.5">
            <div className="flex items-center gap-3">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full border border-edge-soft"
                style={{ backgroundColor: e.corHex ?? "#a1a1aa" }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {e.equipeNome}
                  {e.convocadosIds.length > 0 && (
                    <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn-text align-middle">
                      {e.convocadosIds.length} de {e.membrosEquipe.length}
                    </span>
                  )}
                </p>
                <p className="text-xs text-ink-subtle">
                  {ROTULO_TIPO_ESCALA[e.tipoEscala]}
                  {e.origem === "rodizio" ? " · rodízio" : ""}
                  {e.convocadosIds.length > 0
                    ? " · convocação parcial"
                    : " · equipe inteira"}
                  {e.observacao ? ` · ${e.observacao}` : ""}
                </p>
              </div>
              {!somenteLeitura && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Atalho: registro de presença já no evento/equipe certos */}
                  <Link
                    href={`/presenca?ref=${dataEventoISO}&eventoId=${eventoId}`}
                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong"
                  >
                    Presença
                  </Link>
                  {e.membrosEquipe.length > 0 && !cancelado && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditandoMembrosId(editandoMembrosId === e.id ? null : e.id)
                      }
                      className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-surface-2"
                    >
                      Membros
                    </button>
                  )}
                  {equipesDisponiveis.length > 0 && !cancelado && (
                    <button
                      type="button"
                      onClick={() => setTrocandoId(trocandoId === e.id ? null : e.id)}
                      className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-surface-2"
                    >
                      Trocar
                    </button>
                  )}
                  <form
                    action={removerAction}
                    onSubmit={(ev) => {
                      if (!window.confirm(`Remover a equipe ${e.equipeNome} da escala?`))
                        ev.preventDefault();
                    }}
                  >
                    <input type="hidden" name="escalaId" value={e.id} />
                    <button
                      type="submit"
                      disabled={pRemover}
                      className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-danger-edge hover:bg-danger-faint hover:text-danger-text disabled:opacity-60"
                    >
                      Remover
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Trocar equipe: remove esta e escala a nova (bloqueado se já há
                presenças ativas da equipe atual neste evento). */}
            {trocandoId === e.id && !somenteLeitura && (
              <form
                action={trocarAction}
                onSubmit={(ev) => {
                  const sel = ev.currentTarget.elements.namedItem(
                    "novaEquipeId",
                  ) as HTMLSelectElement;
                  const nome =
                    sel.selectedOptions[0]?.textContent ?? "a nova equipe";
                  if (
                    !window.confirm(
                      `Trocar ${e.equipeNome} por ${nome} neste evento?`,
                    )
                  )
                    ev.preventDefault();
                }}
                className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-3"
              >
                <input type="hidden" name="escalaId" value={e.id} />
                <select
                  name="novaEquipeId"
                  required
                  defaultValue=""
                  className={`${inputCls} min-w-40 flex-1`}
                >
                  <option value="" disabled>
                    Trocar por…
                  </option>
                  {equipesDisponiveis.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.nome}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={pTrocar}
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
                >
                  {pTrocar ? "Trocando…" : "Trocar"}
                </button>
              </form>
            )}

            {/* Convocação por membro: marque quem da equipe está escalado.
                Todos marcados = equipe inteira (sem restrição). */}
            {editandoMembrosId === e.id && !somenteLeitura && (
              <MembrosEscalaForm
                escala={e}
                action={membrosAction}
                pendente={pMembros}
              />
            )}
          </li>
        ))}
      </ul>

      {!somenteLeitura && !cancelado && equipesDisponiveis.length > 0 && (
        <form action={escalarAction} className="mt-4 space-y-3 rounded-xl bg-surface-2 p-3">
          <input type="hidden" name="eventoId" value={eventoId} />
          <div className="flex flex-wrap gap-2">
            <select name="equipeId" required defaultValue="" className={`${inputCls} min-w-40 flex-1`}>
              <option value="" disabled>
                Escalar equipe…
              </option>
              {equipesDisponiveis.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nome}
                </option>
              ))}
            </select>
            <select name="tipoEscala" defaultValue="regular" className={`${inputCls} w-auto`}>
              <option value="regular">Regular</option>
              <option value="especial">Especial (campanha/conferência)</option>
            </select>
          </div>
          <input
            name="observacao"
            maxLength={300}
            placeholder="Observação (opcional)"
            className={inputCls}
          />
          <button
            type="submit"
            disabled={pEscalar}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
          >
            {pEscalar ? "Escalando…" : "Escalar"}
          </button>
        </form>
      )}
      {!somenteLeitura && cancelado && (
        <p className="mt-3 text-xs text-ink-subtle">
          Evento cancelado — reative-o para alterar a escala.
        </p>
      )}

      {/* Pergunta de propagação semanal (regra de cobertura do PDF) */}
      {propagacaoAberta && estadoEscalar?.propagacao && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
        >
          <div className="vidro-forte w-full max-w-md rounded-2xl p-6">
            <h3 className="text-base font-semibold text-ink">
              Equipe {estadoEscalar.propagacao.equipeNome} escalada ✓
            </h3>
            <p className="mt-2 text-sm text-ink-soft">
              Propagar a escala para os demais eventos da semana? A equipe
              cobrirá também:
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl bg-surface-2 p-3 text-sm text-ink-soft">
              {estadoEscalar.propagacao.eventos.map((e) => (
                <li key={e.id}>• {e.rotulo}</li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <form action={propagarAction} className="flex-1">
                <input
                  type="hidden"
                  name="equipeId"
                  value={estadoEscalar.propagacao.equipeId}
                />
                {estadoEscalar.propagacao.eventos.map((e) => (
                  <input key={e.id} type="hidden" name="eventoIds" value={e.id} />
                ))}
                <button
                  type="submit"
                  disabled={pPropagar}
                  className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
                >
                  {pPropagar ? "Propagando…" : "Sim, propagar"}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setPropagacaoDispensada(estadoEscalar.ts)}
                className="flex-1 rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-2"
              >
                Não, só este evento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback padrão: só quando NÃO há pergunta de propagação pendente */}
      {!estadoEscalar?.propagacao && <FeedbackModal estado={estadoEscalar} />}
      <FeedbackModal estado={estadoPropagar} />
      <FeedbackModal estado={estadoRemover} />
      <FeedbackModal
        estado={estadoTrocar}
        onFechar={(ev) => {
          if (ev.ok) setTrocandoId(null);
        }}
      />
      <FeedbackModal
        estado={estadoMembros}
        onFechar={(ev) => {
          if (ev.ok) setEditandoMembrosId(null);
        }}
      />
    </section>
  );
}

// Checklist de convocação de uma escala. Estado local dos checkboxes com
// atalhos "Todos"/"Nenhum". Envia todos os membroIds marcados; a Server Action
// interpreta "todos marcados" como equipe inteira.
function MembrosEscalaForm({
  escala,
  action,
  pendente,
}: {
  escala: Escala;
  action: (formData: FormData) => void;
  pendente: boolean;
}) {
  // Estado inicial: convocados atuais, ou todos se a escala é "equipe inteira".
  const inicial =
    escala.convocadosIds.length > 0
      ? new Set(escala.convocadosIds)
      : new Set(escala.membrosEquipe.map((m) => m.id));
  const [marcados, setMarcados] = useState<Set<string>>(inicial);

  const alternar = (id: string) => {
    setMarcados((prev) => {
      const prox = new Set(prev);
      if (prox.has(id)) prox.delete(id);
      else prox.add(id);
      return prox;
    });
  };

  return (
    <form action={action} className="mt-2 rounded-xl bg-surface-2 p-3">
      <input type="hidden" name="escalaId" value={escala.id} />
      {[...marcados].map((id) => (
        <input key={id} type="hidden" name="membroIds" value={id} />
      ))}

      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-soft">
          Quem está escalado ({marcados.size} de {escala.membrosEquipe.length})
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() =>
              setMarcados(new Set(escala.membrosEquipe.map((m) => m.id)))
            }
            className="rounded-md border border-edge px-2 py-1 text-[11px] font-medium text-ink-soft hover:bg-surface-3"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setMarcados(new Set())}
            className="rounded-md border border-edge px-2 py-1 text-[11px] font-medium text-ink-soft hover:bg-surface-3"
          >
            Nenhum
          </button>
        </div>
      </div>

      <ul className="max-h-56 space-y-0.5 overflow-y-auto">
        {escala.membrosEquipe.map((m) => (
          <li key={m.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-surface-3">
              <input
                type="checkbox"
                checked={marcados.has(m.id)}
                onChange={() => alternar(m.id)}
                className="h-4 w-4 rounded border-edge text-brand focus:ring-brand-ring"
              />
              <span className="truncate">{m.nome}</span>
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={pendente || marcados.size === 0}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
        >
          {pendente ? "Salvando…" : "Salvar convocação"}
        </button>
        <p className="text-[11px] text-ink-subtle">
          Todos marcados = equipe inteira.
        </p>
      </div>
    </form>
  );
}
