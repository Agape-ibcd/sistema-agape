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
  if (status === "ativo" || status === "afastado" || status === "inativo") {
    where.status = status;
  }

  const [membros, equipes] = await Promise.all([
    prisma.membro.findMany({
      where,
      orderBy: { nomeCompleto: "asc" },
      include: { equipe: { select: { nome: true, corHex: true } } },
    }),
    prisma.equipe.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const inputCls =
    "rounded-xl border border-edge px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold uppercase tracking-wide text-ink">Membros</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {membros.length} membro(s) na seleção atual.
          </p>
        </div>
        <Link
          href="/membros/novo"
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
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
          <option value="afastado">Afastados</option>
          <option value="inativo">Inativos</option>
          <option value="todos">Todos</option>
        </select>
        <button
          type="submit"
          className="rounded-xl border border-edge bg-surface px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2"
        >
          Filtrar
        </button>
      </form>

      <ul className="divide-y divide-edge-soft overflow-hidden rounded-2xl border border-edge-soft bg-surface">
        {membros.length === 0 && (
          <li className="p-6 text-center text-sm text-ink-subtle">
            Nenhum membro encontrado com estes filtros.
          </li>
        )}
        {membros.map((m) => (
          <li key={m.id}>
            <Link
              href={`/membros/${m.id}`}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2"
            >
              <Avatar nome={m.nomeCompleto} fotoUrl={m.fotoUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {m.nomeCompleto}
                </p>
                <p className="truncate text-xs text-ink-subtle">
                  {m.equipe?.nome ?? "Sem equipe"}
                  {m.celularWhatsapp ? ` · ${m.celularWhatsapp}` : ""}
                </p>
              </div>
              {m.status === "inativo" && (
                <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink-soft">
                  Inativo
                </span>
              )}
              {m.status === "afastado" && (
                <span
                  className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn-text"
                  title={m.motivoStatus ?? undefined}
                >
                  Afastado
                  {m.retornoPrevisto
                    ? ` até ${m.retornoPrevisto.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`
                    : ""}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
