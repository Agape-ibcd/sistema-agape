"use client";

import { useActionState } from "react";
import { confirmarAlteracaoDados } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";

export function ConfirmarAlteracaoForm({ token }: { token: string }) {
  const [estado, formAction, pendente] = useActionState(confirmarAlteracaoDados, null);

  return (
    <>
      <form action={formAction} className="mt-6">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          disabled={pendente}
          className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pendente ? "Confirmando…" : "Confirmar alteração"}
        </button>
      </form>
      <FeedbackModal estado={estado} />
    </>
  );
}
