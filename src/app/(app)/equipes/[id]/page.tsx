import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { EquipeForm } from "../EquipeForm";
import { GerirEquipe } from "./GerirEquipe";

export default async function EquipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermissao("gerenciar_membros");
  const { id } = await params;

  const [equipe, membrosAtivos] = await Promise.all([
    prisma.equipe.findUnique({
      where: { id },
      include: {
        membros: {
          // Afastados continuam pertencendo à equipe — aparecem com o rótulo.
          where: { status: { not: "inativo" } },
          orderBy: { nomeCompleto: "asc" },
          select: { id: true, nomeCompleto: true, fotoUrl: true, status: true },
        },
        lideres: {
          where: { dataFim: null },
          orderBy: { dataInicio: "asc" },
          include: {
            membro: { select: { id: true, nomeCompleto: true, fotoUrl: true } },
          },
        },
      },
    }),
    prisma.membro.findMany({
      // Monitores não participam de equipes — fora dos candidatos.
      where: { status: "ativo", nivelAcesso: { not: "monitor" } },
      orderBy: { nomeCompleto: "asc" },
      select: {
        id: true,
        nomeCompleto: true,
        fotoUrl: true,
        equipeId: true,
        equipe: { select: { nome: true } },
      },
    }),
  ]);
  if (!equipe) notFound();

  const lideresAtivosIds = new Set(equipe.lideres.map((l) => l.membro.id));

  const candidatosMembro = membrosAtivos
    .filter((m) => m.equipeId !== id)
    .map((m) => ({
      id: m.id,
      nomeCompleto: m.nomeCompleto,
      fotoUrl: m.fotoUrl,
      equipeNome: m.equipe?.nome ?? null,
    }));

  const candidatosLider = membrosAtivos
    .filter((m) => !lideresAtivosIds.has(m.id))
    .map((m) => ({
      id: m.id,
      nomeCompleto: m.nomeCompleto,
      fotoUrl: m.fotoUrl,
      equipeNome: m.equipe?.nome ?? null,
    }));

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <Link href="/equipes" className="text-sm text-brand-text hover:underline">
          ← Equipes
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <span
            className="h-4 w-4 rounded-full border border-edge-soft"
            style={{ backgroundColor: equipe.corHex ?? "#a1a1aa" }}
            aria-hidden
          />
          <h1 className="text-3xl font-display font-semibold uppercase tracking-wide text-ink">{equipe.nome}</h1>
          {equipe.status === "inativa" && (
            <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-medium text-ink-soft">
              Inativa
            </span>
          )}
        </div>
      </header>

      <EquipeForm
        equipe={{
          id: equipe.id,
          nome: equipe.nome,
          turnoPadrao: equipe.turnoPadrao,
          corHex: equipe.corHex ?? "",
          status: equipe.status,
        }}
      />

      <GerirEquipe
        equipeId={equipe.id}
        lideres={equipe.lideres.map((l) => ({
          vinculoId: l.id,
          membroId: l.membro.id,
          nomeCompleto: l.membro.nomeCompleto,
          fotoUrl: l.membro.fotoUrl,
          desde: l.dataInicio.toLocaleDateString("pt-BR", { timeZone: "UTC" }),
        }))}
        membrosDaEquipe={equipe.membros.map((m) => ({
          id: m.id,
          nomeCompleto:
            m.status === "afastado"
              ? `${m.nomeCompleto} (afastado)`
              : m.nomeCompleto,
          fotoUrl: m.fotoUrl,
          equipeNome: equipe.nome,
        }))}
        candidatosMembro={candidatosMembro}
        candidatosLider={candidatosLider}
      />
    </div>
  );
}
