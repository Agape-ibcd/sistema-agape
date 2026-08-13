"use client";

import { useActionState, useState } from "react";
import { gerarLinkConvite, convidarPorEmail, type EstadoConvite } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";

const inputCls =
  "w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";

export function ConviteForm() {
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [pendenteLink, setPendenteLink] = useState(false);
  const [erroLink, setErroLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const [estadoEmail, acaoEmail, pendenteEmail] = useActionState<EstadoConvite, FormData>(
    convidarPorEmail,
    null,
  );

  const podeCompartilhar =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function aoGerarLink() {
    setPendenteLink(true);
    setErroLink(null);
    try {
      const r = await gerarLinkConvite();
      if (r?.ok && r.url) {
        setLinkGerado(r.url);
        setCopiado(false);
      } else {
        setErroLink(r?.message ?? "Não foi possível gerar o link.");
      }
    } finally {
      setPendenteLink(false);
    }
  }

  async function compartilharLink() {
    if (!linkGerado) return;
    try {
      await navigator.share({
        title: "Convite ao Ministério Ágape",
        text: "Venha conhecer o Ministério Ágape!",
        url: linkGerado,
      });
    } catch {
      // Cancelado pelo usuário — sem problema, o link continua visível para copiar.
    }
  }

  async function copiarLink() {
    if (!linkGerado) return;
    try {
      await navigator.clipboard.writeText(linkGerado);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Compartilhar link */}
      <div className="rounded-2xl border border-edge-soft vidro-leve p-5">
        <h2 className="text-base font-semibold text-ink">Compartilhar link</h2>
        <p className="mt-1 text-sm text-ink-soft">Gere um link de convite e envie por WhatsApp.</p>

        <button
          type="button"
          onClick={aoGerarLink}
          disabled={pendenteLink}
          className="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pendenteLink ? "Gerando…" : "Gerar link de convite"}
        </button>

        {erroLink && <p className="mt-2 text-sm text-danger-text">{erroLink}</p>}

        {linkGerado && (
          <div className="mt-4 space-y-2 rounded-xl border border-edge-soft bg-surface-2 p-3">
            <p className="break-all text-sm text-ink">{linkGerado}</p>
            <div className="flex flex-wrap gap-2">
              {podeCompartilhar && (
                <button
                  type="button"
                  onClick={compartilharLink}
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong"
                >
                  Compartilhar
                </button>
              )}
              <button
                type="button"
                onClick={copiarLink}
                className="rounded-xl border border-edge px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2"
              >
                {copiado ? "Copiado!" : "Copiar link"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Convidar por e-mail */}
      <div className="rounded-2xl border border-edge-soft vidro-leve p-5">
        <h2 className="text-base font-semibold text-ink">Convidar por e-mail</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Informe o e-mail da pessoa e enviaremos o convite diretamente.
        </p>

        <form action={acaoEmail} className="mt-4 flex flex-wrap gap-2">
          <input
            name="email"
            type="email"
            required
            placeholder="email@exemplo.com"
            className={`${inputCls} max-w-sm flex-1`}
          />
          <button
            type="submit"
            disabled={pendenteEmail}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
          >
            {pendenteEmail ? "Enviando…" : "Enviar convite"}
          </button>
        </form>
      </div>

      <FeedbackModal estado={estadoEmail} />
    </div>
  );
}
