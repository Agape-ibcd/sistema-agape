"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

// Botão que abre um painel flutuante — usado para recolher grupos de opções
// (período, filtros, exportar) num único controle, especialmente valioso no
// celular. Fecha ao clicar fora, ao pressionar Esc, ou via `fechar()` passado
// para o conteúdo (ex.: depois de escolher uma opção).
export function Popover({
  rotulo,
  badge,
  align = "left",
  panelClassName = "",
  children,
}: {
  rotulo: React.ReactNode;
  // Contador opcional (ex.: nº de filtros ativos) exibido como selo no botão.
  badge?: number;
  // Lado preferido para o painel pendurar a partir do botão — só usado quando
  // há espaço; do contrário o painel é reposicionado para caber na tela.
  align?: "left" | "right";
  panelClassName?: string;
  children: (fechar: () => void) => React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const painelId = useId();

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  // Mantém o painel sempre dentro da viewport: parte do lado preferido
  // (`align`) mas é deslocado se estourar a borda esquerda/direita — crítico
  // no celular, onde o botão pode ficar perto da borda da tela.
  useLayoutEffect(() => {
    if (!aberto || !raiz.current || !painel.current) return;
    const wrapper = raiz.current.getBoundingClientRect();
    const p = painel.current.getBoundingClientRect();
    const margem = 8;
    // clientWidth é mais confiável que window.innerWidth (que pode ficar
    // desatualizado após navegações client-side em alguns navegadores).
    const larguraTela = document.documentElement.clientWidth;
    const desejado = align === "right" ? wrapper.right - p.width : wrapper.left;
    const min = margem;
    const max = larguraTela - p.width - margem;
    const alvo = Math.min(Math.max(desejado, min), max);
    painel.current.style.left = `${alvo - wrapper.left}px`;
  }, [aberto, align]);

  return (
    <div ref={raiz} className="relative inline-block text-left">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={painelId}
        onClick={() => setAberto((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
          aberto
            ? "border-brand bg-brand-faint text-brand-text"
            : "border-edge bg-surface text-ink-soft hover:bg-surface-2"
        }`}
      >
        {rotulo}
        {!!badge && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
            {badge}
          </span>
        )}
        <ChevronBaixo aberto={aberto} />
      </button>

      {aberto && (
        <div
          ref={painel}
          id={painelId}
          role="menu"
          style={{ left: 0 }}
          className={`vidro-forte absolute z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-3 ${panelClassName}`}
        >
          {children(() => setAberto(false))}
        </div>
      )}
    </div>
  );
}

function ChevronBaixo({ aberto }: { aberto: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
