"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

// ─────────────────────────────────────────────────────────────────────────
// Tema claro/escuro. A classe `dark` no <html> é a fonte da verdade visual
// (tokens em globals.css). A escolha é gravada em DOIS lugares:
//   • COOKIE "tema"  → lido pelo servidor no root layout, que já manda o HTML
//                      com a classe certa (ver o comentário lá: sem isso o
//                      React apagava a classe ao re-adquirir o <html>);
//   • localStorage   → leitura rápida do script inline antes da pintura.
// Este provider sincroniza o estado React com a classe e expõe o toggle.
// ─────────────────────────────────────────────────────────────────────────

export type Tema = "claro" | "escuro";

// 1 ano. Sem httpOnly de propósito: quem grava é o próprio navegador (script
// inline e toggle). Não é dado sensível — é preferência visual.
function gravarCookieTema(tema: Tema) {
  document.cookie = `tema=${tema};path=/;max-age=31536000;SameSite=Lax`;
}

// Preferência já gravada neste aparelho (cookie primeiro — é o que o servidor
// enxerga; localStorage como retaguarda). null = ainda não escolhido.
function preferenciaGravada(): Tema | null {
  const doCookie = /(?:^|; )tema=(claro|escuro)/.exec(document.cookie)?.[1];
  if (doCookie === "claro" || doCookie === "escuro") return doCookie;
  try {
    const salvo = localStorage.getItem("tema");
    if (salvo === "claro" || salvo === "escuro") return salvo;
  } catch {
    /* armazenamento indisponível (modo privado) */
  }
  return null;
}

function temaNoDom(): Tema {
  return document.documentElement.classList.contains("dark") ? "escuro" : "claro";
}

// O estado do tema é DERIVADO da classe no <html> (fonte da verdade visual),
// observada por MutationObserver. Assim o provider nunca precisa de setState
// dentro de efeito — o lint do repo proíbe — e qualquer mudança na classe
// (toggle ou rede de segurança) recolore os gráficos automaticamente.
function assinarClasseHtml(aoMudar: () => void) {
  const obs = new MutationObserver(aoMudar);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => obs.disconnect();
}

const TemaContext = createContext<{ tema: Tema; alternar: () => void }>({
  tema: "claro",
  alternar: () => {},
});

export function useTema() {
  return useContext(TemaContext);
}

export function ThemeProvider({
  temaInicial,
  children,
}: {
  // Tema que o SERVIDOR usou para renderizar (lido do cookie no root layout).
  // Serve de snapshot na hidratação, garantindo que servidor e cliente
  // concordem antes de o navegador assumir.
  temaInicial: Tema;
  children: React.ReactNode;
}) {
  const tema = useSyncExternalStore(
    assinarClasseHtml,
    temaNoDom,
    () => temaInicial,
  );

  const alternar = useCallback(() => {
    const novo: Tema = temaNoDom() === "escuro" ? "claro" : "escuro";
    // O cookie é o que faz o SERVIDOR já renderizar o tema certo na próxima
    // navegação; sem ele a classe só existiria no cliente.
    gravarCookieTema(novo);
    try {
      localStorage.setItem("tema", novo);
    } catch {
      /* armazenamento indisponível (modo privado) — o tema vale só na sessão */
    }
    // O observer acima propaga a mudança para o estado (e para os gráficos).
    document.documentElement.classList.toggle("dark", novo === "escuro");
  }, []);

  // Rede de segurança da PRIMEIRA visita: aí ainda não havia cookie, então o
  // servidor mandou o HTML no claro e o script inline resolveu o tema do
  // sistema — mas o React apaga a classe ao re-adquirir o <html>. Repõe o que
  // ficou gravado. Da segunda visita em diante o cookie já resolve na origem.
  // O tema é PERSISTENTE: não acompanha mudanças do tema do sistema depois
  // dessa primeira resolução (só o botão de alternância muda).
  useEffect(() => {
    const preferido = preferenciaGravada();
    if (!preferido) {
      gravarCookieTema(temaNoDom());
      return;
    }
    if (preferido !== temaNoDom()) {
      document.documentElement.classList.toggle("dark", preferido === "escuro");
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
