import "server-only";
import { prisma } from "@/lib/prisma";
import { podeEditarMembroAlvo } from "@/lib/acessoMembros";
import type { UsuarioAtual } from "@/lib/auth";

// ─────────────────────────────────────────────────────────────────────────
// Resumo compacto de um membro para o hover card (foto/nome/equipe/próxima
// escala) usado em várias telas. Convocação da próxima escala segue a mesma
// regra de src/lib/escalaMembros.ts: EscalaEquipeEvento sem linhas em
// EscalaMembro convoca a equipe inteira; com linhas, só os membros listados.
// ─────────────────────────────────────────────────────────────────────────

const JANELA_DESEMPENHO_DIAS = 90;

export type MembroResumo = {
  id: string;
  nomeCompleto: string;
  fotoUrl: string | null;
  dataNascimentoBR: string | null; // dd/mm
  status: "ativo" | "afastado" | "inativo";
  motivoStatus: string | null; // só relevante quando afastado/inativo
  equipe: { nome: string; corHex: string | null } | null;
  lideraEquipes: { nome: string; corHex: string | null }[];
  proximaEscala: {
    dataEventoBR: string; // dd/mm/aaaa
    tipoEventoNome: string;
    equipeNome: string;
  } | null;
  // % (0-100, arredondado) nos últimos 90 dias; null = sem convocações no período.
  assiduidade90: number | null;
  pontualidade90: number | null;
  // Se quem pediu o resumo (usuário logado) pode editar ESTE membro — decide
  // se o hover card mostra o ícone de editar (ex.: monitor nunca pode).
  podeEditar: boolean;
};

export async function buscarResumoMembro(
  membroId: string,
  usuario: UsuarioAtual,
): Promise<MembroResumo | null> {
  const membro = await prisma.membro.findUnique({
    where: { id: membroId },
    select: {
      id: true,
      nomeCompleto: true,
      fotoUrl: true,
      dataNascimento: true,
      status: true,
      motivoStatus: true,
      nivelAcesso: true,
      equipeId: true,
      equipe: { select: { nome: true, corHex: true } },
      liderancas: {
        where: { dataFim: null },
        select: { equipe: { select: { nome: true, corHex: true } } },
      },
    },
  });
  if (!membro) return null;

  const [proximaEscala, desempenho] = await Promise.all([
    membro.equipeId ? buscarProximaEscalaDoMembro(membro.id, membro.equipeId) : null,
    buscarDesempenho90Dias(membro.id),
  ]);

  return {
    id: membro.id,
    nomeCompleto: membro.nomeCompleto,
    fotoUrl: membro.fotoUrl,
    dataNascimentoBR: membro.dataNascimento ? formatarDataBR(membro.dataNascimento) : null,
    status: membro.status,
    motivoStatus: membro.motivoStatus,
    equipe: membro.equipe,
    lideraEquipes: membro.liderancas.map((l) => l.equipe),
    proximaEscala,
    assiduidade90: desempenho.assiduidade90,
    pontualidade90: desempenho.pontualidade90,
    podeEditar: podeEditarMembroAlvo(usuario, membro),
  };
}

async function buscarDesempenho90Dias(
  membroId: string,
): Promise<{ assiduidade90: number | null; pontualidade90: number | null }> {
  const desde = new Date();
  desde.setDate(desde.getDate() - JANELA_DESEMPENHO_DIAS);

  const presencas = await prisma.presenca.findMany({
    where: { membroId, excluidoEm: null, evento: { dataEvento: { gte: desde } } },
    select: { presente: true, pontualidade: true },
  });

  const convocacoes = presencas.length;
  const presentes = presencas.filter((p) => p.presente).length;
  const pontuais = presencas.filter((p) => p.presente && p.pontualidade === "pontual").length;

  return {
    assiduidade90: convocacoes === 0 ? null : Math.round((presentes / convocacoes) * 100),
    pontualidade90: presentes === 0 ? null : Math.round((pontuais / presentes) * 100),
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
