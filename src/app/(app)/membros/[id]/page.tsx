import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { ROTULO_NIVEL } from "@/lib/rbac";
import { MembroForm } from "../MembroForm";

export default async function EditarMembroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermissao("gerenciar_membros");
  const { id } = await params;

  const [membro, equipes] = await Promise.all([
    prisma.membro.findUnique({
      where: { id },
      include: { equipe: { select: { nome: true } } },
    }),
    prisma.equipe.findMany({
      where: { status: "ativa" },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);
  if (!membro) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <Link href="/membros" className="text-sm text-brand-text hover:underline">
          ← Membros
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-display font-semibold uppercase tracking-wide text-ink">{membro.nomeCompleto}</h1>
          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-text">
            {ROTULO_NIVEL[membro.nivelAcesso]}
          </span>
          {membro.status === "inativo" && (
            <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-medium text-ink-soft">
              Inativo
            </span>
          )}
          {membro.status === "afastado" && (
            <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn-text">
              Afastado
            </span>
          )}
        </div>
      </header>

      <MembroForm
        membro={{
          id: membro.id,
          nomeCompleto: membro.nomeCompleto,
          email: membro.email,
          celular: membro.celularWhatsapp ?? "",
          dataNascimento: membro.dataNascimento
            ? membro.dataNascimento.toISOString().slice(0, 10)
            : "",
          equipeId: membro.equipeId ?? "",
          observacao: membro.observacao ?? "",
          fotoUrl: membro.fotoUrl,
          status: membro.status,
          motivoStatus: membro.motivoStatus ?? "",
          retornoPrevisto: membro.retornoPrevisto
            ? membro.retornoPrevisto.toISOString().slice(0, 10)
            : "",
        }}
        equipes={equipes}
      />
    </div>
  );
}
