"use client";

import { Suspense } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login } from "./actions";
import { Rodape } from "@/components/Rodape";
import { AgapeLogo } from "@/components/AgapeLogo";

function LoginForm() {
  const [estado, formAction, pendente] = useActionState(login, null);
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl bg-surface p-6 shadow-sm"
    >
      <input type="hidden" name="redirect" value={redirect} />

      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-ink-soft"
        >
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
          placeholder="voce@exemplo.com"
        />
      </div>

      <div>
        <label
          htmlFor="senha"
          className="mb-1 block text-sm font-medium text-ink-soft"
        >
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
          placeholder="••••••••"
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
        {pendente ? "Entrando…" : "Entrar"}
      </button>

      <p className="text-center text-sm">
        <Link
          href="/recuperar-senha"
          className="text-brand-text hover:underline"
        >
          Esqueci minha senha
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="agape-dots flex flex-1 flex-col bg-surface-2">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <AgapeLogo markSize={72} />
            <p className="mt-3 text-sm text-ink-subtle">
              Igreja Batista Casa de Deus · Jundiaí/SP
            </p>
            {/* Versículo — estilo "verse" da marca (serif itálico, filete dourado) */}
            <blockquote className="mt-5 border-l-2 border-warn pl-4 text-left">
              <p className="font-serif text-base italic text-ink-soft">
                “Acolhei-vos uns aos outros, como também Cristo nos acolheu, para
                glória de Deus.”
              </p>
              <cite className="mt-1 block text-xs font-semibold not-italic tracking-wide text-warn-text">
                Romanos 15:7
              </cite>
            </blockquote>
          </div>

          <Suspense
            fallback={
              <div className="rounded-2xl bg-surface p-6 text-center text-sm text-ink-subtle shadow-sm">
                Carregando…
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </div>
      <Rodape />
    </div>
  );
}
