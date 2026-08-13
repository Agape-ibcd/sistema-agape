"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// O botão "Quero participar" só habilita depois que a pessoa rolar até o
// fim do texto explicativo (pedido do usuário) — um sentinela invisível no
// fim do conteúdo dispara o IntersectionObserver assim que entra na tela.
export function ExplicacaoMinisterio({
  token,
  children,
}: {
  token: string;
  children: React.ReactNode;
}) {
  const [lida, setLida] = useState(false);
  const sentinelaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const alvo = sentinelaRef.current;
    if (!alvo) return;

    // Se o conteúdo já couber inteiro na tela (sem precisar rolar — comum em
    // telas grandes ou texto curto), libera direto: não há nada para "rolar
    // até o fim". IntersectionObserver cobre o caso normal (conteúdo maior
    // que a tela); esta checagem é só o caso-limite em que ele nunca
    // precisaria disparar.
    if (document.documentElement.scrollHeight <= window.innerHeight + 4) {
      setLida(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) setLida(true);
      },
      { threshold: 1 },
    );
    observer.observe(alvo);
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      <div className="prose-agape space-y-3 text-sm leading-relaxed text-ink-soft">
        {children}
      </div>
      <div ref={sentinelaRef} aria-hidden className="h-px" />

      <div className="mt-6">
        {lida ? (
          <Link
            href={`/convidado/${token}/participar`}
            className="block w-full rounded-xl bg-brand px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-brand-strong"
          >
            Quero participar do Ministério Ágape
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-xl bg-surface-3 px-4 py-3 text-center text-sm font-semibold text-ink-subtle"
          >
            Role até o fim para continuar
          </button>
        )}
      </div>
    </div>
  );
}
