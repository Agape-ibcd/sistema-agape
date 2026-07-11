"use client";

import { useActionState } from "react";
import { gerarEventos } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";

// Botão "Gerar eventos": cria as instâncias dos próximos 3 meses para todos
// os tipos ativos (ou um tipo específico). Idempotente — pode clicar de novo.
export function GerarEventosBotao({
  tipoEventoId,
  rotulo = "Gerar eventos (3 meses)",
}: {
  tipoEventoId?: string;
  rotulo?: string;
}) {
  const [estado, formAction, pendente] = useActionState(gerarEventos, null);

  return (
    <>
      <form
        action={formAction}
        onSubmit={(e) => {
          if (
            !window.confirm(
              "Gerar as instâncias de eventos dos próximos 3 meses? Eventos já existentes não são duplicados nem alterados.",
            )
          )
            e.preventDefault();
        }}
      >
        {tipoEventoId && (
          <input type="hidden" name="tipoEventoId" value={tipoEventoId} />
        )}
        <button
          type="submit"
          disabled={pendente}
          className="rounded-xl border border-emerald-600 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
        >
          {pendente ? "Gerando…" : rotulo}
        </button>
      </form>
      <FeedbackModal estado={estado} />
    </>
  );
}
