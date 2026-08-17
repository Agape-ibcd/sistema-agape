"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Sobreposição leve (coração pulsando) enquanto uma navegação está em
// andamento — a página atual continua visível por baixo, sem tela em
// branco/escura. Detecta o clique em qualquer link interno (captura no
// document, cobre o menu inteiro sem precisar instrumentar cada <Link>) e
// desliga quando o pathname muda, ou seja, quando a rota de destino já
// renderizou.
//
// Só aparece se a navegação realmente demorar (ATRASO_MOSTRAR abaixo) — a
// maioria das trocas de rota é rápida o bastante pra não precisar de
// indicador nenhum, e mostrar/sumir instantaneamente só pisca a tela à toa.
const ATRASO_MOSTRAR_MS = 400;

export function IndicadorNavegacao() {
  const [navegando, setNavegando] = useState(false);
  const pathname = usePathname();
  const timeoutMostrarRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutSegurancaRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Rota mudou (navegação concluída): esconde o indicador.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intencional e bem delimitado por [pathname], não é uma cascata
    setNavegando(false);
    if (timeoutMostrarRef.current) clearTimeout(timeoutMostrarRef.current);
    if (timeoutSegurancaRef.current) clearTimeout(timeoutSegurancaRef.current);
  }, [pathname]);

  useEffect(() => {
    function aoClicar(e: MouseEvent) {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)
        return;
      // Clique já interceptado por outra coisa (ex.: hover card de pessoa
      // abrindo em vez de navegar, dentro de um <Link> da lista) — não é
      // uma navegação de verdade, não mostra o indicador.
      if (e.defaultPrevented) return;
      const alvo = (e.target as HTMLElement).closest("a[href]");
      if (!alvo) return;
      const href = alvo.getAttribute("href") ?? "";
      const destino = alvo.getAttribute("target");
      if (!href.startsWith("/") || destino === "_blank") return;
      if (href === pathname) return;

      if (timeoutMostrarRef.current) clearTimeout(timeoutMostrarRef.current);
      timeoutMostrarRef.current = setTimeout(() => setNavegando(true), ATRASO_MOSTRAR_MS);

      // Trava de segurança: se a navegação não completar (erro, cancelada),
      // não deixa o indicador preso na tela para sempre.
      if (timeoutSegurancaRef.current) clearTimeout(timeoutSegurancaRef.current);
      timeoutSegurancaRef.current = setTimeout(() => setNavegando(false), 8000);
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
