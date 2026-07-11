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
          where: { status: "ativo" },
          orderBy: { nomeCompleto: "asc" },
          select: { id: true, nomeCompleto: true, fotoUrl: true },
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
      where: { status: "ativo" },
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
        <Link href="/equipes" className="text-sm text-emerald-700 hover:underline">
          ← Equipes
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <span
            className="h-4 w-4 rounded-full border border-black/10"
            style={{ backgroundColor: equipe.corHex ?? "#a1a1aa" }}
            aria-hidden
          />
          <h1 className="text-2xl font-bold text-zinc-900">{equipe.nome}</h1>
          {equipe.status === "inativa" && (
            <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
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
          nomeCompleto: m.nomeCompleto,
          fotoUrl: m.fotoUrl,
          equipeNome: equipe.nome,
        }))}
        candidatosMembro={candidatosMembro}
        candidatosLider={candidatosLider}
      />
    </div>
  );
}
