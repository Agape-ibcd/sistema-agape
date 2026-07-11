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
          <h1 className="text-2xl font-bold text-zinc-900">Equipes</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {equipes.length} equipe(s) cadastrada(s).
          </p>
        </div>
        <Link
          href="/equipes/nova"
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Nova equipe
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {equipes.map((e) => (
          <Link
            key={e.id}
            href={`/equipes/${e.id}`}
            className="rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span
                className="mt-1 h-4 w-4 shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: e.corHex ?? "#a1a1aa" }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-zinc-900">{e.nome}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Turno {ROTULO_TURNO[e.turnoPadrao]} · {e._count.membros} membro(s) ativo(s)
                </p>
                {e.lideres.length > 0 && (
                  <p className="mt-1 truncate text-xs text-zinc-600">
                    Líderes: {e.lideres.map((l) => l.membro.nomeCompleto).join(", ")}
                  </p>
                )}
              </div>
              {e.status === "inativa" && (
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">
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
