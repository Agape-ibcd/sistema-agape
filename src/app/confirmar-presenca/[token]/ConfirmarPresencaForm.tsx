"use client";

import { useActionState } from "react";
import { responderConfirmacaoEscala } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";

export function ConfirmarPresencaForm({ token }: { token: string }) {
  const [estado, formAction, pendente] = useActionState(responderConfirmacaoEscala, null);

  return (
    <>
      <form action={formAction} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          name="resposta"
          value="confirmado"
          disabled={pendente}
          className="flex-1 rounded-xl bg-success px-4 py-3 text-sm font-semibold text-white transition hover:bg-success-strong disabled:opacity-60"
        >
          {pendente ? "Enviando…" : "✓ Confirmo presença"}
        </button>
        <button
          type="submit"
          name="resposta"
          value="recusado"
          disabled={pendente}
          className="flex-1 rounded-xl border border-edge px-4 py-3 text-sm font-semibold text-ink-soft transition hover:bg-surface-2 disabled:opacity-60"
        >
          Não poderei comparecer
        </button>
      </form>
      <FeedbackModal estado={estado} />
    </>
  );
}
