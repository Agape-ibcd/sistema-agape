"use client";

import { useActionState } from "react";
import { trocarSenhaObrigatoria } from "./actions";

const inputCls =
  "w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";

export function TrocarSenhaForm() {
  const [estado, formAction, pendente] = useActionState(trocarSenhaObrigatoria, null);

  return (
    <form action={formAction} className="vidro space-y-4 rounded-2xl p-6">
      <div>
        <label htmlFor="senhaNova" className="mb-1 block text-sm font-medium text-ink-soft">
          Nova senha
        </label>
        <input
          id="senhaNova"
          name="senhaNova"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputCls}
          placeholder="Pelo menos 8 caracteres"
        />
      </div>

      <div>
        <label htmlFor="senhaConfirma" className="mb-1 block text-sm font-medium text-ink-soft">
          Confirmar nova senha
        </label>
        <input
          id="senhaConfirma"
          name="senhaConfirma"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputCls}
          placeholder="Repita a nova senha"
        />
      </div>

      {estado && !estado.ok && (
        <p className="rounded-lg bg-danger-faint px-3 py-2 text-sm text-danger-text">
          {estado.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
      >
        {pendente ? "Salvando…" : "Definir nova senha"}
      </button>
    </form>
  );
}
