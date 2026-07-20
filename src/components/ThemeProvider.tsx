"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

// ─────────────────────────────────────────────────────────────────────────
// Tema claro/escuro. A classe `dark` no <html> é a fonte da verdade visual
// (tokens em globals.css). Um script inline no root layout aplica a classe
// ANTES da pintura (sem flash), lendo localStorage("tema") com fallback em
// prefers-color-scheme. Este provider só sincroniza o estado React com a
// classe e expõe o toggle — que persiste a escolha explícita do usuário.
// ─────────────────────────────────────────────────────────────────────────

export type Tema = "claro" | "escuro";

const TemaContext = createContext<{ tema: Tema; alternar: () => void }>({
  tema: "claro",
  alternar: () => {},
});

export function useTema() {
  return useContext(TemaContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
      ? "escuro"
      : "claro",
  );

  const aplicar = useCallback((novo: Tema, persistir: boolean) => {
    document.documentElement.classList.toggle("dark", novo === "escuro");
    if (persistir) {
      try {
        localStorage.setItem("tema", novo);
      } catch {
        /* armazenamento indisponível (modo privado) — o tema vale só na sessão */
      }
    }
    setTema(novo);
  }, []);

  const alternar = useCallback(() => {
    aplicar(tema === "escuro" ? "claro" : "escuro", true);
  }, [tema, aplicar]);

  // O tema é PERSISTENTE: o app não acompanha mais mudanças do tema do sistema
  // (modo escuro automático do celular trocava a tela por conta própria, que o
  // usuário lia como "esqueceu minha escolha"). O script inline do root layout
  // já grava a resolução inicial; isto é só uma rede de segurança para o caso
  // de ele não ter rodado. Não mexe em estado — o tema visual já está aplicado.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem("tema");
      if (salvo !== "claro" && salvo !== "escuro") {
        localStorage.setItem(
          "tema",
          document.documentElement.classList.contains("dark") ? "escuro" : "claro",
        );
      }
    } catch {
      /* armazenamento indisponível (modo privado) — vale só nesta sessão */
    }
  }, []);

  return (
    <TemaContext.Provider value={{ tema, alternar }}>
      {children}
    </TemaContext.Provider>
  );
}

const assinaturaVazia = () => () => {};

// Botão de alternância (sol/lua). Renderiza o ícone só após montar para não
// divergir do HTML do servidor (que não sabe o tema salvo no navegador).
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { tema, alternar } = useTema();
  // true no cliente após a hidratação, false no HTML do servidor.
  const montado = useSyncExternalStore(
    assinaturaVazia,
    () => true,
    () => false,
  );

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={
        montado && tema === "escuro"
          ? "Mudar para o tema claro"
          : "Mudar para o tema escuro"
      }
      title={
        montado && tema === "escuro"
          ? "Mudar para o tema claro"
          : "Mudar para o tema escuro"
      }
      className={`rounded-lg p-2 text-ink-soft hover:bg-surface-3 ${className}`}
    >
      {!montado ? (
        <span className="block h-5 w-5" aria-hidden />
      ) : tema === "escuro" ? (
        // Sol — volta ao claro
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // Lua — vai ao escuro
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  );
}
