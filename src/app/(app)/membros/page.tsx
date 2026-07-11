import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";

// Lista de membros com busca por nome/e-mail e filtros por equipe e status.
export default async function MembrosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; equipe?: string; status?: string }>;
}) {
  await requirePermissao("gerenciar_membros");
  const { busca = "", equipe = "", status = "ativo" } = await searchParams;

  const where: Prisma.MembroWhereInput = {};
  if (busca) {
    where.OR = [
      { nomeCompleto: { contains: busca, mode: "insensitive" } },
      { email: { contains: busca, mode: "insensitive" } },
    ];
  }
  if (equipe) where.equipeId = equipe;
  if (status === "ativo" || status === "inativo") where.status = status;

  const [membros, equipes] = await Promise.all([
    prisma.membro.findMany({
      where,
      orderBy: { nomeCompleto: "asc" },
      include: { equipe: { select: { nome: true, corHex: true } } },
    }),
    prisma.equipe.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const inputCls =
    "rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Membros</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {membros.length} membro(s) na seleção atual.
          </p>
        </div>
        <Link
          href="/membros/novo"
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Novo membro
        </Link>
      </header>

      {/* Filtros (GET — a URL é compartilhável) */}
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="busca"
          defaultValue={busca}
          placeholder="Buscar por nome ou e-mail"
          className={`${inputCls} min-w-40 flex-1`}
        />
        <select name="equipe" defaultValue={equipe} className={inputCls}>
          <option value="">Todas as equipes</option>
          {equipes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className={inputCls}>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
          <option value="todos">Todos</option>
        </select>
        <button
          type="submit"
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Filtrar
        </button>
      </form>

      <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {membros.length === 0 && (
          <li className="p-6 text-center text-sm text-zinc-500">
            Nenhum membro encontrado com estes filtros.
          </li>
        )}
        {membros.map((m) => (
          <li key={m.id}>
            <Link
              href={`/membros/${m.id}`}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-zinc-50"
            >
              <Avatar nome={m.nomeCompleto} fotoUrl={m.fotoUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {m.nomeCompleto}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {m.equipe?.nome ?? "Sem equipe"}
                  {m.celularWhatsapp ? ` · ${m.celularWhatsapp}` : ""}
                </p>
              </div>
              {m.status === "inativo" && (
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">
                  Inativo
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
