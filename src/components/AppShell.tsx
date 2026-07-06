"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ItemMenu } from "@/lib/nav";

type Props = {
  itens: ItemMenu[];
  usuario: { nome: string; nivelRotulo: string; equipe: string | null };
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
        ? "bg-emerald-600 text-white"
        : "text-zinc-700 hover:bg-zinc-100"
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
    <div className="flex min-h-full flex-col md:flex-row">
      {/* Topo (mobile) */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-emerald-700">Ágape</span>
        </div>
        <button
          type="button"
          aria-label="Abrir menu"
          aria-expanded={menuAberto}
          onClick={() => setMenuAberto((v) => !v)}
          className="rounded-lg p-2 text-zinc-700 hover:bg-zinc-100"
        >
          <span className="block h-0.5 w-6 bg-current" />
          <span className="mt-1.5 block h-0.5 w-6 bg-current" />
          <span className="mt-1.5 block h-0.5 w-6 bg-current" />
        </button>
      </header>

      {/* Menu mobile expansível */}
      {menuAberto && (
        <div className="border-b border-zinc-200 bg-white px-4 py-3 md:hidden">
          <PainelUsuario usuario={usuario} />
          <div className="mt-3">{listaLinks}</div>
        </div>
      )}

      {/* Barra lateral (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white p-4 md:flex">
        <div className="mb-4 px-1">
          <p className="text-xl font-bold text-emerald-700">Ministério Ágape</p>
          <p className="text-xs text-zinc-500">IBCD · Jundiaí/SP</p>
        </div>
        <PainelUsuario usuario={usuario} />
        <div className="mt-4 flex-1">{listaLinks}</div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 bg-zinc-50 p-4 md:p-8">{children}</main>
    </div>
  );
}

function PainelUsuario({
  usuario,
}: {
  usuario: { nome: string; nivelRotulo: string; equipe: string | null };
}) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <p className="truncate text-sm font-semibold text-zinc-900">
        {usuario.nome}
      </p>
      <p className="text-xs text-emerald-700">{usuario.nivelRotulo}</p>
      {usuario.equipe && (
        <p className="truncate text-xs text-zinc-500">{usuario.equipe}</p>
      )}
      <form action="/auth/signout" method="post" className="mt-2">
        <button
          type="submit"
          className="text-xs font-medium text-zinc-500 underline hover:text-red-600"
        >
          Sair
        </button>
      </form>
    </div>
  );
}
