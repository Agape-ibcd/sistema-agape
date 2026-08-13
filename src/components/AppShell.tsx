"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ItemMenu } from "@/lib/nav";
import { ThemeToggle } from "@/components/ThemeProvider";
import { Avatar } from "@/components/Avatar";
import { AgapeLogo } from "@/components/AgapeLogo";
import { Rodape } from "@/components/Rodape";
import { SinoNotificacoes } from "@/components/SinoNotificacoes";
import { IndicadorNavegacao } from "@/components/IndicadorNavegacao";
import { SugestaoAtalho } from "@/components/SugestaoAtalho";

type Props = {
  itens: ItemMenu[];
  usuario: {
    nome: string;
    nivelRotulo: string;
    equipe: string | null;
    fotoUrl: string | null;
  };
  children: React.ReactNode;
};

const CHAVE_MENU_OCULTO = "menu-lateral-oculto";

// Casca responsiva (mobile-first): topo com menu-hambúrguer no celular e
// barra lateral fixa no desktop. O menu já chega filtrado por nível de acesso.
export function AppShell({ itens, usuario, children }: Props) {
  const [menuAberto, setMenuAberto] = useState(false);
  // Barra lateral (desktop) pode ser ocultada para ganhar espaço de tela —
  // preferência persistida no navegador.
  const [menuOculto, setMenuOculto] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (localStorage.getItem(CHAVE_MENU_OCULTO) === "1") setMenuOculto(true);
  }, []);

  function alternarMenuOculto() {
    setMenuOculto((v) => {
      const novo = !v;
      localStorage.setItem(CHAVE_MENU_OCULTO, novo ? "1" : "0");
      return novo;
    });
  }

  const linkClasses = (href: string) => {
    const ativo = pathname === href || pathname.startsWith(`${href}/`);
    return `block rounded-xl px-4 py-2.5 text-sm font-medium transition ${
      ativo
        ? "bg-brand text-white"
        : "text-ink-soft hover:bg-surface-3"
    }`;
  };

  const listaLinks = (
    <nav className="flex flex-col gap-1">
      {itens.map((item) =>
        item.destaque ? (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuAberto(false)}
            className="menu-item-destaque block rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:bg-surface-3"
          >
            <span className="menu-item-destaque-texto">{item.label}</span>
          </Link>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuAberto(false)}
            className={linkClasses(item.href)}
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <IndicadorNavegacao />
      <SugestaoAtalho />

      {/* Topo (mobile) — sticky com vidro: o conteúdo desliza desfocado por
          baixo ao rolar. */}
      <header className="vidro sticky top-0 z-40 flex items-center justify-between border-0 border-b px-4 py-3 md:hidden">
        <AgapeLogo markSize={34} />
        <div className="flex items-center gap-1">
          <SinoNotificacoes />
          <ThemeToggle />
          <button
            type="button"
            aria-label="Abrir menu"
            aria-expanded={menuAberto}
            onClick={() => setMenuAberto((v) => !v)}
            className="rounded-lg p-2 text-ink-soft hover:bg-surface-3"
          >
            <span className="block h-0.5 w-6 bg-current" />
            <span className="mt-1.5 block h-0.5 w-6 bg-current" />
            <span className="mt-1.5 block h-0.5 w-6 bg-current" />
          </button>
        </div>
      </header>

      {/* Menu mobile — SOBREPÕE a página (não empurra o conteúdo), no mesmo
          padrão dos painéis flutuantes (sino/popovers): backdrop desfocado +
          gaveta lateral em vidro-forte. */}
      {menuAberto && (
        <div className="md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMenuAberto(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="vidro-forte fixed right-0 top-0 z-50 flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto p-4 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <AgapeLogo markSize={34} />
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setMenuAberto(false)}
                className="rounded-lg p-2 text-ink-soft hover:bg-surface-3"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <PainelUsuario usuario={usuario} />
            <div className="mt-3">{listaLinks}</div>
          </div>
        </div>
      )}

      {/* Barra lateral (desktop) — vidro fixo na altura da tela */}
      {!menuOculto && (
        <aside className="vidro sticky top-0 hidden max-h-screen w-64 shrink-0 flex-col overflow-y-auto border-0 border-r p-4 md:flex">
          <div className="mb-4 flex items-start justify-between gap-2 px-1">
            <AgapeLogo markSize={40} subtitulo="IBCD · Jundiaí/SP" />
            <div className="flex items-center gap-1">
              <SinoNotificacoes />
              <ThemeToggle className="-mr-1" />
            </div>
          </div>
          <PainelUsuario usuario={usuario} />
          <div className="mt-4">
            {listaLinks}
            <button
              type="button"
              onClick={alternarMenuOculto}
              className="mt-1 flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-ink-subtle hover:bg-surface-3"
            >
              <IconeOcultarMenu />
              Ocultar menu
            </button>
          </div>
        </aside>
      )}

      {/* Menu oculto (desktop): botão para reabrir + sino flutuante quando
          há lembrete pendente. Só existe em telas md+; no celular o menu
          continua sendo o hambúrguer de sempre. */}
      {menuOculto && (
        <div className="hidden md:contents">
          <button
            type="button"
            aria-label="Mostrar menu"
            onClick={alternarMenuOculto}
            className="vidro-forte fixed left-2 top-1/2 z-30 -translate-y-1/2 rounded-full p-2 text-ink-soft hover:bg-surface-3"
          >
            <IconeMostrarMenu />
          </button>
          <div className="fixed right-4 top-4 z-30">
            <SinoNotificacoes flutuante />
          </div>
        </div>
      )}

      {/* Conteúdo + rodapé — sem fundo próprio: deixa a aurora do body
          transparecer (é ela que os vidros desfocam). */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 p-4 md:p-8">{children}</main>
        <Rodape />
      </div>
    </div>
  );
}

function PainelUsuario({
  usuario,
}: {
  usuario: {
    nome: string;
    nivelRotulo: string;
    equipe: string | null;
    fotoUrl: string | null;
  };
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-2/60 p-3">
      <Avatar nome={usuario.nome} fotoUrl={usuario.fotoUrl} tamanho={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {usuario.nome}
        </p>
        <p className="text-xs text-brand-text">{usuario.nivelRotulo}</p>
        {usuario.equipe && (
          <p className="truncate text-xs text-ink-subtle">{usuario.equipe}</p>
        )}
        <form action="/auth/signout" method="post" className="mt-1">
          <button
            type="submit"
            className="text-xs font-medium text-ink-subtle underline hover:text-danger-text"
          >
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}

function IconeOcultarMenu() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="m14 10-2 2 2 2" />
    </svg>
  );
}

function IconeMostrarMenu() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="m11 10 2 2-2 2" />
    </svg>
  );
}
