"use client";

import { useActionState } from "react";
import { gerarLinkTelegram, desvincularTelegram } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";

export function TelegramVinculo({ vinculado }: { vinculado: boolean }) {
  const [estado, gerarAction, pendente] = useActionState(gerarLinkTelegram, null);
  const [estadoDesvincular, desvincularAction, pendenteDesvincular] = useActionState(
    desvincularTelegram,
    null,
  );

  return (
    <div className="mb-6 rounded-2xl border border-edge-soft bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">Telegram</h2>

      {vinculado ? (
        <>
          <p className="mt-1 text-sm text-success-text">
            Vinculado — você recebe avisos de escala e aniversário por aqui também.
          </p>
          <form action={desvincularAction} className="mt-3">
            <button
              type="submit"
              disabled={pendenteDesvincular}
              className="rounded-xl border border-edge px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2 disabled:opacity-60"
            >
              {pendenteDesvincular ? "Desvinculando…" : "Desvincular"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-soft">
            Vincule para receber avisos de escala e aniversário também pelo
            Telegram, além do e-mail.
          </p>
          <form action={gerarAction} className="mt-3">
            <button
              type="submit"
              disabled={pendente}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
            >
              {pendente ? "Gerando link…" : "Vincular Telegram"}
            </button>
          </form>
          {estado?.ok && estado.link && (
            <a
              href={estado.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block rounded-xl bg-brand-faint px-4 py-2.5 text-center text-sm font-semibold text-brand-text hover:bg-brand-soft"
            >
              Abrir no Telegram para concluir →
            </a>
          )}
        </>
      )}

      <FeedbackModal estado={estado?.ok ? null : estado} />
      <FeedbackModal estado={estadoDesvincular} />
    </div>
  );
}
