"use client";

import { useState, useActionState } from "react";
import { escalarEquipe, propagarEscala, removerEscala } from "../actions";
import { FeedbackModal } from "@/components/FeedbackModal";

type Escala = {
  id: string;
  equipeNome: string;
  corHex: string | null;
  tipoEscala: "regular" | "especial" | "cobertura";
  origem: "manual" | "rodizio";
  observacao: string | null;
};

type Props = {
  eventoId: string;
  escalas: Escala[];
  equipesDisponiveis: { id: string; nome: string; corHex: string | null }[];
  cancelado: boolean;
};

const ROTULO_TIPO_ESCALA = {
  regular: "Regular",
  especial: "Especial",
  cobertura: "Cobertura semanal",
} as const;

export function EscalasPanel({ eventoId, escalas, equipesDisponiveis, cancelado }: Props) {
  const [estadoEscalar, escalarAction, pEscalar] = useActionState(escalarEquipe, null);
  const [estadoPropagar, propagarAction, pPropagar] = useActionState(propagarEscala, null);
  const [estadoRemover, removerAction, pRemover] = useActionState(removerEscala, null);
  // ts da pergunta de propagação já respondida/dispensada.
  const [propagacaoDispensada, setPropagacaoDispensada] = useState<number | null>(null);

  const inputCls =
    "w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

  // A pergunta fica aberta até o usuário dispensar ("Não") ou a propagação
  // responder (estadoPropagar mais novo que a escalação que gerou a pergunta).
  const propagacaoAberta =
    estadoEscalar?.ok &&
    estadoEscalar.propagacao &&
    estadoEscalar.ts !== propagacaoDispensada &&
    !(estadoPropagar && estadoPropagar.ts > estadoEscalar.ts);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold text-zinc-900">Escala de equipes</h2>

      <ul className="mt-3 divide-y divide-zinc-100">
        {escalas.length === 0 && (
          <li className="py-3 text-sm text-amber-700">
            Nenhuma equipe escalada neste evento.
          </li>
        )}
        {escalas.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2.5">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
              style={{ backgroundColor: e.corHex ?? "#a1a1aa" }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900">{e.equipeNome}</p>
              <p className="text-xs text-zinc-500">
                {ROTULO_TIPO_ESCALA[e.tipoEscala]}
                {e.origem === "rodizio" ? " · rodízio" : ""}
                {e.observacao ? ` · ${e.observacao}` : ""}
              </p>
            </div>
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
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
              >
                Remover
              </button>
            </form>
          </li>
        ))}
      </ul>

      {!cancelado && equipesDisponiveis.length > 0 && (
        <form action={escalarAction} className="mt-4 space-y-3 rounded-xl bg-zinc-50 p-3">
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
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {pEscalar ? "Escalando…" : "Escalar"}
          </button>
        </form>
      )}
      {cancelado && (
        <p className="mt-3 text-xs text-zinc-500">
          Evento cancelado — reative-o para alterar a escala.
        </p>
      )}

      {/* Pergunta de propagação semanal (regra de cobertura do PDF) */}
      {propagacaoAberta && estadoEscalar?.propagacao && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">
              Equipe {estadoEscalar.propagacao.equipeNome} escalada ✓
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              Propagar a escala para os demais eventos da semana? A equipe
              cobrirá também:
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">
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
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {pPropagar ? "Propagando…" : "Sim, propagar"}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setPropagacaoDispensada(estadoEscalar.ts)}
                className="flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
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
    </section>
  );
}
