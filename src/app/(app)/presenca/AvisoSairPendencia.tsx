"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { haPendenciaNaPagina } from "./pendenciaGuard";

const MENSAGEM =
  "Ainda há membro(s) sem presença/ausência registrada nesta seção. Deseja sair mesmo assim?";

// Avisa antes de sair de /presenca havendo membro sem presença/ausência
// lançada: (1) fechar aba/recarregar/navegar para fora do app, via
// beforeunload nativo do navegador; (2) navegar para outro link interno
// (menu, trocar de evento/semana), interceptando o clique em fase de
// CAPTURA — precisa rodar ANTES do próprio <Link> do Next navegar, e
// `stopPropagation` evita que o handler dele dispare em cima.
export function AvisoSairPendencia() {
  const router = useRouter();

  useEffect(() => {
    function aoDescarregar(e: BeforeUnloadEvent) {
      if (!haPendenciaNaPagina()) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", aoDescarregar);
    return () => window.removeEventListener("beforeunload", aoDescarregar);
  }, []);

  useEffect(() => {
    function aoClicar(e: MouseEvent) {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const alvo = (e.target as HTMLElement).closest("a[href]");
      if (!alvo) return;
      const href = alvo.getAttribute("href") ?? "";
      const destino = alvo.getAttribute("target");
      if (!href.startsWith("/") || destino === "_blank") return;
      const atual = `${window.location.pathname}${window.location.search}`;
      if (href === atual) return;
      if (!haPendenciaNaPagina()) return;

      e.preventDefault();
      e.stopPropagation();
      if (window.confirm(MENSAGEM)) {
        router.push(href);
      }
    }

    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, [router]);

  return null;
}
