import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import type { ConfigRecorrencia } from "@/lib/recorrencia";
import { TipoEventoForm } from "../TipoEventoForm";
import { GerarEventosBotao } from "../GerarEventosBotao";

export default async function EditarTipoEventoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermissao("gerenciar_tipos_evento");
  const { id } = await params;

  const tipo = await prisma.tipoEvento.findUnique({ where: { id } });
  if (!tipo) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <Link href="/eventos/tipos" className="text-sm text-brand-text hover:underline">
          ← Tipos de evento
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-display font-semibold uppercase tracking-wide text-ink">{tipo.nome}</h1>
          {tipo.ativo && tipo.tipoRecorrencia !== "avulso" && (
            <GerarEventosBotao
              tipoEventoId={tipo.id}
              rotulo="Gerar eventos deste tipo"
            />
          )}
        </div>
      </header>

      <TipoEventoForm
        tipo={{
          id: tipo.id,
          nome: tipo.nome,
          descricao: tipo.descricao ?? "",
          horarioInicio: tipo.horarioInicio,
          categoria: tipo.categoria,
          tipoRecorrencia: tipo.tipoRecorrencia,
          config: (tipo.configRecorrencia ?? {}) as ConfigRecorrencia,
          ativo: tipo.ativo,
        }}
      />
    </div>
  );
}
