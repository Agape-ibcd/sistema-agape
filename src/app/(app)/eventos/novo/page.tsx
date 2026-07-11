import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { EventoAvulsoForm } from "./EventoAvulsoForm";

// Evento avulso/extra: instância única (campanha, conferência, batismo extra…).
export default async function NovoEventoPage() {
  await requirePermissao("criar_eventos_extras");

  const tipos = await prisma.tipoEvento.findMany({
    where: { ativo: true },
    orderBy: [{ tipoRecorrencia: "desc" }, { nome: "asc" }], // avulsos primeiro
    select: { id: true, nome: true, horarioInicio: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <Link href="/eventos" className="text-sm text-emerald-700 hover:underline">
          ← Calendário
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">Novo evento avulso</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Cria uma única instância no calendário — ideal para campanhas,
          conferências e eventos especiais.
        </p>
      </header>
      <EventoAvulsoForm tipos={tipos} />
    </div>
  );
}
