import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";

const ROTULO_TURNO = { manha: "Manhã", noite: "Noite", variavel: "Variável" } as const;

export default async function EquipesPage() {
  await requirePermissao("gerenciar_membros");

  const equipes = await prisma.equipe.findMany({
    orderBy: [{ status: "asc" }, { nome: "asc" }],
    include: {
      _count: { select: { membros: { where: { status: "ativo" } } } },
      lideres: {
        where: { dataFim: null },
        include: { membro: { select: { nomeCompleto: true } } },
      },
    },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold uppercase tracking-wide text-ink">Equipes</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {equipes.length} equipe(s) cadastrada(s).
          </p>
        </div>
        <Link
          href="/equipes/nova"
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
        >
          + Nova equipe
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {equipes.map((e) => (
          <Link
            key={e.id}
            href={`/equipes/${e.id}`}
            className="rounded-2xl border border-edge-soft vidro-leve p-5 transition hover:border-brand-edge hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span
                className="mt-1 h-4 w-4 shrink-0 rounded-full border border-edge-soft"
                style={{ backgroundColor: e.corHex ?? "#a1a1aa" }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{e.nome}</p>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  Turno {ROTULO_TURNO[e.turnoPadrao]} · {e._count.membros} membro(s) ativo(s)
                </p>
                {e.lideres.length > 0 && (
                  <p className="mt-1 truncate text-xs text-ink-soft">
                    Líderes: {e.lideres.map((l) => l.membro.nomeCompleto).join(", ")}
                  </p>
                )}
              </div>
              {e.status === "inativa" && (
                <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink-soft">
                  Inativa
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
