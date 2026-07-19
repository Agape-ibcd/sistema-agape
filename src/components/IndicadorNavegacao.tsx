"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Sobreposição leve (coração pulsando) enquanto uma navegação está em
// andamento — a página atual continua visível por baixo, sem tela em
// branco/escura. Detecta o clique em qualquer link interno (captura no
// document, cobre o menu inteiro sem precisar instrumentar cada <Link>) e
// desliga quando o pathname muda, ou seja, quando a rota de destino já
// renderizou.
export function IndicadorNavegacao() {
  const [navegando, setNavegando] = useState(false);
  const pathname = usePathname();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNavegando(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [pathname]);

  useEffect(() => {
    function aoClicar(e: MouseEvent) {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)
        return;
      const alvo = (e.target as HTMLElement).closest("a[href]");
      if (!alvo) return;
      const href = alvo.getAttribute("href") ?? "";
      const destino = alvo.getAttribute("target");
      if (!href.startsWith("/") || destino === "_blank") return;
      if (href === pathname) return;

      setNavegando(true);
      // Trava de segurança: se a navegação não completar (erro, cancelada),
      // não deixa o indicador preso na tela para sempre.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setNavegando(false), 8000);
    }

    document.addEventListener("click", aoClicar);
    return () => document.removeEventListener("click", aoClicar);
  }, [pathname]);

  if (!navegando) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
    >
      <div className="vidro-forte flex items-center gap-2 rounded-full px-5 py-3">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          style={{ fill: "var(--accent)" }}
          aria-hidden
          className="coracao-pulsar"
        >
          <path d="M12 21s-6.7-4.35-9.3-8.3C.8 9.7 1.6 6.4 4.4 5 6.6 3.9 9 4.6 12 7.3 15 4.6 17.4 3.9 19.6 5c2.8 1.4 3.6 4.7 1.7 7.7C18.7 16.65 12 21 12 21z" />
        </svg>
        <span className="text-xs font-medium text-ink-subtle">
          Carregando…
        </span>
      </div>
    </div>
  );
}
