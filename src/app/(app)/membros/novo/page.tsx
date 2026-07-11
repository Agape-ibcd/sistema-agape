import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { MembroForm } from "../MembroForm";

export default async function NovoMembroPage() {
  await requirePermissao("gerenciar_membros");
  const equipes = await prisma.equipe.findMany({
    where: { status: "ativa" },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <Link href="/membros" className="text-sm text-emerald-700 hover:underline">
          ← Membros
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">Novo membro</h1>
      </header>
      <MembroForm membro={null} equipes={equipes} />
    </div>
  );
}
