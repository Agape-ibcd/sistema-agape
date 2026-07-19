"use client";

import { useRef, useActionState } from "react";
import { alterarSenha } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";

const inputCls =
  "w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";
const labelCls = "mb-1 block text-sm font-medium text-ink-soft";

// Troca de senha do próprio usuário (disponível a todos os níveis).
// A troca de E-MAIL, com código de confirmação, chega na Etapa 6.
export function SenhaForm() {
  const [estado, formAction, pendente] = useActionState(alterarSenha, null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="mt-6 space-y-4 rounded-2xl border border-edge-soft vidro-leve p-5"
      >
        <div>
          <h2 className="text-base font-semibold text-ink">Trocar senha</h2>
          <p className="mt-0.5 text-xs text-ink-subtle">
            Use pelo menos 8 caracteres. Você continuará conectado após a troca.
          </p>
        </div>

        <div>
          <label htmlFor="senhaAtual" className={labelCls}>
            Senha atual
          </label>
          <input
            id="senhaAtual"
            name="senhaAtual"
            type="password"
            required
            autoComplete="current-password"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="senhaNova" className={labelCls}>
              Nova senha
            </label>
            <input
              id="senhaNova"
              name="senhaNova"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="senhaConfirma" className={labelCls}>
              Confirmar nova senha
            </label>
            <input
              id="senhaConfirma"
              name="senhaConfirma"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={inputCls}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pendente}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pendente ? "Alterando…" : "Alterar senha"}
        </button>
      </form>

      <FeedbackModal
        estado={estado}
        onFechar={(e) => {
          if (e.ok) formRef.current?.reset();
        }}
      />
    </>
  );
}
