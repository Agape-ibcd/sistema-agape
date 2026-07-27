"use client";

import { useState } from "react";

// Seção com título clicável que abre/fecha o conteúdo. Começa fechada.
export function Colapsavel({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <section className="mb-6">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="mb-3 flex w-full items-center gap-2 text-left"
      >
        <svg
          className={`h-4 w-4 shrink-0 text-ink-soft transition-transform ${aberto ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
      </button>
      {aberto && children}
    </section>
  );
}
