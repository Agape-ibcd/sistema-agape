"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ItemMenu } from "@/lib/nav";
import { ThemeToggle } from "@/components/ThemeProvider";
import { Avatar } from "@/components/Avatar";
import { Rodape } from "@/components/Rodape";

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

// Casca responsiva (mobile-first): topo com menu-hambúrguer no celular e
// barra lateral fixa no desktop. O menu já chega filtrado por nível de acesso.
export function AppShell({ itens, usuario, children }: Props) {
  const [menuAberto, setMenuAberto] = useState(false);
  const pathname = usePathname();

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
      {itens.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMenuAberto(false)}
          className={linkClasses(item.href)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      {/* Topo (mobile) */}
      <header className="flex items-center justify-between border-b border-edge-soft bg-surface px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-brand-text">Ágape</span>
        </div>
        <div className="flex items-center gap-1">
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

      {/* Menu mobile expansível */}
      {menuAberto && (
        <div className="border-b border-edge-soft bg-surface px-4 py-3 md:hidden">
          <PainelUsuario usuario={usuario} />
          <div className="mt-3">{listaLinks}</div>
        </div>
      )}

      {/* Barra lateral (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-edge-soft bg-surface p-4 md:flex">
        <div className="mb-4 flex items-start justify-between gap-2 px-1">
          <div>
            <p className="text-xl font-bold text-brand-text">Ministério Ágape</p>
            <p className="text-xs text-ink-subtle">IBCD · Jundiaí/SP</p>
          </div>
          <ThemeToggle className="-mr-1" />
        </div>
        <PainelUsuario usuario={usuario} />
        <div className="mt-4 flex-1">{listaLinks}</div>
      </aside>

      {/* Conteúdo + rodapé */}
      <div className="flex min-w-0 flex-1 flex-col bg-surface-2">
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
    <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
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
