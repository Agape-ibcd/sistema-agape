"use client";

import { Suspense } from "react";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "./actions";

function LoginForm() {
  const [estado, formAction, pendente] = useActionState(login, null);
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl bg-white p-6 shadow-sm"
    >
      <input type="hidden" name="redirect" value={redirect} />

      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-zinc-700"
        >
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          placeholder="voce@exemplo.com"
        />
      </div>

      <div>
        <label
          htmlFor="senha"
          className="mb-1 block text-sm font-medium text-zinc-700"
        >
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          placeholder="••••••••"
        />
      </div>

      {estado && !estado.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {estado.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {pendente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-emerald-700">
            Ministério Ágape
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Igreja Batista Casa de Deus · Jundiaí/SP
          </p>
        </div>

        <Suspense
          fallback={
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-zinc-500 shadow-sm">
              Carregando…
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
