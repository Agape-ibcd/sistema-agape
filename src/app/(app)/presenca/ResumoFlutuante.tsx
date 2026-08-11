"use client";

import { useEffect, useRef, useState } from "react";
import { contarTudoPresenca, type ContagemSecao } from "./resumoFlutuanteRegistry";

const INTERVALO_POLL_MS = 800;

// Painel flutuante discreto (contadores ao vivo de escalados/presentes/
// ausentes), arrastável com mouse OU toque (Pointer Events unifica os dois)
// e fechável. Some no mount; aparece sozinho no primeiro registro de
// presença/ausência da tela e, se fechado, fica fechado até recarregar a
// página. Lê a contagem por polling leve — ver resumoFlutuanteRegistry.ts.
export function ResumoFlutuante() {
  const [contagem, setContagem] = useState<ContagemSecao>({ escalados: 0, presentes: 0, ausentes: 0 });
  const [visivel, setVisivel] = useState(false);
  const fechadoRef = useRef(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const arrastoRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const c = contarTudoPresenca();
      setContagem(c);
      if (!fechadoRef.current && c.presentes + c.ausentes > 0) {
        setVisivel(true);
      }
    }, INTERVALO_POLL_MS);
    return () => clearInterval(id);
  }, []);

  function aoIniciarArrasto(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-fechar]")) return;
    const painel = painelRef.current;
    if (!painel) return;
    const rect = painel.getBoundingClientRect();
    arrastoRef.current = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
    painel.setPointerCapture(e.pointerId);
  }

  function aoMoverArrasto(e: React.PointerEvent<HTMLDivElement>) {
    if (!arrastoRef.current) return;
    const painel = painelRef.current;
    if (!painel) return;
    const margem = 4;
    const larguraTela = document.documentElement.clientWidth;
    const alturaTela = document.documentElement.clientHeight;
    const x = Math.min(
      Math.max(e.clientX - arrastoRef.current.offsetX, margem),
      larguraTela - painel.offsetWidth - margem,
    );
    const y = Math.min(
      Math.max(e.clientY - arrastoRef.current.offsetY, margem),
      alturaTela - painel.offsetHeight - margem,
    );
    setPos({ x, y });
  }

  function aoSoltarArrasto(e: React.PointerEvent<HTMLDivElement>) {
    arrastoRef.current = null;
    painelRef.current?.releasePointerCapture(e.pointerId);
  }

  if (!visivel) return null;

  return (
    <div
      ref={painelRef}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      className={`fixed z-30 touch-none select-none rounded-xl border border-edge-soft bg-surface/90 px-3 py-1.5 text-[11px] text-ink-soft shadow-md backdrop-blur-sm ${
        pos ? "" : "bottom-4 right-4"
      }`}
    >
      <div
        onPointerDown={aoIniciarArrasto}
        onPointerMove={aoMoverArrasto}
        onPointerUp={aoSoltarArrasto}
        className="flex cursor-move items-center gap-2.5"
      >
        <span className="flex items-center gap-1" title="Escalados">
          <IconePessoas />
          {contagem.escalados}
        </span>
        <span className="flex items-center gap-1 text-success-text" title="Presentes">
          <IconeCheckMini />
          {contagem.presentes}
        </span>
        <span className="flex items-center gap-1 text-danger-text" title="Ausentes">
          <IconeXMini />
          {contagem.ausentes}
        </span>
        <button
          type="button"
          data-fechar
          title="Fechar"
          aria-label="Fechar"
          onClick={() => {
            fechadoRef.current = true;
            setVisivel(false);
          }}
          className="ml-0.5 text-ink-faint hover:text-danger-text"
        >
          <IconeXMini />
        </button>
      </div>
    </div>
  );
}

function IconePessoas() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8.5" cy="8" r="3" />
      <path d="M2.5 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <path d="M16 8.2a2.7 2.7 0 1 0 0-5.4" />
      <path d="M15 14.2c2.9.4 4.9 2.7 4.9 5.8" />
    </svg>
  );
}

function IconeCheckMini() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function IconeXMini() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
