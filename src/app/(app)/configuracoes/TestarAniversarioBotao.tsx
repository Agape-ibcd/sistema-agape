"use client";

import { useActionState } from "react";
import { testarAniversarioAgora } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";

export function TestarAniversarioBotao() {
  const [estado, formAction, pendente] = useActionState(testarAniversarioAgora, null);

  return (
    <>
      <form action={formAction}>
        <button
          type="submit"
          disabled={pendente}
          className="shrink-0 rounded-xl border border-edge bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-2 disabled:opacity-60"
        >
          {pendente ? "Enviando…" : "Testar aniversário agora"}
        </button>
      </form>
      <FeedbackModal estado={estado} />
    </>
  );
}
