import "server-only";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────
// Resumo compacto de um membro para o hover card (foto/nome/equipe/próxima
// escala) usado em várias telas. Convocação da próxima escala segue a mesma
// regra de src/lib/escalaMembros.ts: EscalaEquipeEvento sem linhas em
// EscalaMembro convoca a equipe inteira; com linhas, só os membros listados.
// ─────────────────────────────────────────────────────────────────────────

export type MembroResumo = {
  id: string;
  nomeCompleto: string;
  fotoUrl: string | null;
  dataNascimentoBR: string | null; // dd/mm
  status: "ativo" | "afastado" | "inativo";
  equipe: { nome: string; corHex: string | null } | null;
  lideraEquipes: { nome: string; corHex: string | null }[];
  proximaEscala: {
    dataEventoBR: string; // dd/mm/aaaa
    tipoEventoNome: string;
    equipeNome: string;
  } | null;
};

export async function buscarResumoMembro(membroId: string): Promise<MembroResumo | null> {
  const membro = await prisma.membro.findUnique({
    where: { id: membroId },
    select: {
      id: true,
      nomeCompleto: true,
      fotoUrl: true,
      dataNascimento: true,
      status: true,
      equipeId: true,
      equipe: { select: { nome: true, corHex: true } },
      liderancas: {
        where: { dataFim: null },
        select: { equipe: { select: { nome: true, corHex: true } } },
      },
    },
  });
  if (!membro) return null;

  const proximaEscala = membro.equipeId
    ? await buscarProximaEscalaDoMembro(membro.id, membro.equipeId)
    : null;

  return {
    id: membro.id,
    nomeCompleto: membro.nomeCompleto,
    fotoUrl: membro.fotoUrl,
    dataNascimentoBR: membro.dataNascimento ? formatarDataBR(membro.dataNascimento) : null,
    status: membro.status,
    equipe: membro.equipe,
    lideraEquipes: membro.liderancas.map((l) => l.equipe),
    proximaEscala,
  };
}

async function buscarProximaEscalaDoMembro(
  membroId: string,
  equipeId: string,
): Promise<MembroResumo["proximaEscala"]> {
  const escalas = await prisma.escalaEquipeEvento.findMany({
    where: {
      equipeId,
      evento: { status: "agendado", dataEvento: { gte: new Date() } },
    },
    include: {
      evento: { select: { dataEvento: true, tipoEvento: { select: { nome: true } } } },
      equipe: { select: { nome: true } },
      membrosEscalados: { select: { membroId: true } },
    },
    orderBy: { evento: { dataEvento: "asc" } },
  });

  for (const escala of escalas) {
    const convocacao = escala.membrosEscalados;
    const convocado = convocacao.length === 0 || convocacao.some((c) => c.membroId === membroId);
    if (convocado) {
      return {
        dataEventoBR: formatarDataCompletaBR(escala.evento.dataEvento),
        tipoEventoNome: escala.evento.tipoEvento.nome,
        equipeNome: escala.equipe.nome,
      };
    }
  }
  return null;
}

function formatarDataBR(d: Date): string {
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}`;
}

function formatarDataCompletaBR(d: Date): string {
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const ano = d.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}
