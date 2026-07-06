"use client";

import { useState } from "react";
import type { EstadoAcao } from "@/lib/actions";

// Popup padrão de confirmação com a resposta do servidor (sucesso/erro).
// Diretriz do PDF (seção 6): toda operação de escrita mostra um popup com o
// retorno do servidor — nunca falha silenciosa. Renderize este componente
// passando o `estado` de um useActionState.
//
// O estado de "aberto" é derivado do carimbo `ts` da última ação: enquanto o
// usuário não fecha (dispensa aquele `ts`), o popup fica visível — e reabre
// automaticamente quando chega um novo resultado (ts diferente).
export function FeedbackModal({ estado }: { estado: EstadoAcao }) {
  const [dispensadoTs, setDispensadoTs] = useState<number | null>(null);

  if (!estado || estado.ts === dispensadoTs) return null;

  const ok = estado.ok;
  const fechar = () => setDispensadoTs(estado.ts);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={fechar}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
              ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
            }`}
            aria-hidden
          >
            {ok ? "✓" : "!"}
          </span>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-zinc-900">
              {ok ? "Operação concluída" : "Não foi possível concluir"}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">{estado.message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={fechar}
          className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-white ${
            ok
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
