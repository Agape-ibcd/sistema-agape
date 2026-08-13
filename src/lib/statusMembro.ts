import "server-only";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { parseDataISO } from "@/lib/recorrencia";
import { podeEditarMembroAlvo } from "@/lib/acessoMembros";
import type { UsuarioAtual } from "@/lib/auth";
import type { StatusMembro } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────
// Mudança de status de membro — regra única usada pela ação individual
// (/membros) e pelas ações em massa (/usuarios).
//
//  ativo    → atua normalmente.
//  afastado → temporário (cirurgia, viagem…): MANTÉM equipe e login, sai das
//             listas de presença (não gera convocação nem falta no período).
//             Guarda motivo e retorno previsto; reativação é manual.
//  inativo  → saiu do ministério: sai da equipe e perde o acesso ao sistema.
// ─────────────────────────────────────────────────────────────────────────

export type ResultadoStatus = { ok: boolean; message: string };

const ROTULO_ACAO: Record<StatusMembro, string> = {
  ativo: "reativar",
  afastado: "afastar",
  inativo: "inativar",
};

export async function aplicarStatusMembro(
  executor: UsuarioAtual,
  membroId: string,
  novoStatus: StatusMembro,
  motivo: string,
  retornoPrevistoStr: string,
): Promise<ResultadoStatus> {
  const erro = (message: string): ResultadoStatus => ({ ok: false, message });

  if (membroId === executor.membroId) {
    return erro(`Você não pode ${ROTULO_ACAO[novoStatus]} o próprio cadastro.`);
  }
  if (novoStatus === "afastado" && !motivo.trim()) {
    return erro("Informe o motivo do afastamento.");
  }

  let retornoPrevisto: Date | null = null;
  if (novoStatus === "afastado" && retornoPrevistoStr.trim()) {
    retornoPrevisto = parseDataISO(retornoPrevistoStr.trim());
    if (!retornoPrevisto) return erro("Data de retorno prevista inválida.");
  }

  const antes = await prisma.membro.findUnique({ where: { id: membroId } });
  if (!antes) return erro("Membro não encontrado.");
  if (!podeEditarMembroAlvo(executor, antes)) {
    return erro("Você não tem permissão para alterar o status deste cadastro.");
  }
  if (antes.status === novoStatus) {
    return erro(`${antes.nomeCompleto} já está com o status "${novoStatus}".`);
  }

  // Nunca deixar o sistema sem um Super Administrador ativo.
  if (antes.nivelAcesso === "super_admin" && novoStatus !== "ativo") {
    const outros = await prisma.membro.count({
      where: {
        nivelAcesso: "super_admin",
        id: { not: membroId },
        status: "ativo",
      },
    });
    if (outros === 0) {
      return erro(
        `Não é possível ${ROTULO_ACAO[novoStatus]} o único Super Administrador ativo.`,
      );
    }
  }

  await prisma.membro.update({
    where: { id: membroId },
    data: {
      status: novoStatus,
      // Inativar tira da equipe (regra do sistema); afastado permanece nela.
      ...(novoStatus === "inativo" ? { equipeId: null } : {}),
      motivoStatus: novoStatus === "ativo" ? null : motivo.trim() || null,
      retornoPrevisto: novoStatus === "afastado" ? retornoPrevisto : null,
    },
  });

  await writeAudit({
    usuarioId: executor.membroId,
    acao: ROTULO_ACAO[novoStatus],
    tabelaAfetada: "membros",
    registroId: membroId,
    dadosAnteriores: {
      status: antes.status,
      equipeId: antes.equipeId,
      motivoStatus: antes.motivoStatus,
      retornoPrevisto: antes.retornoPrevisto?.toISOString() ?? null,
    },
    dadosNovos: {
      status: novoStatus,
      equipeId: novoStatus === "inativo" ? null : antes.equipeId,
      motivoStatus: novoStatus === "ativo" ? null : motivo.trim() || null,
      retornoPrevisto: retornoPrevisto?.toISOString() ?? null,
    },
  });

  const nome = antes.nomeCompleto;
  const message =
    novoStatus === "inativo"
      ? `${nome} foi inativado(a): saiu da equipe e perdeu o acesso ao sistema. O histórico permanece.`
      : novoStatus === "afastado"
        ? `${nome} foi afastado(a)${retornoPrevisto ? ` até ${retornoPrevisto.toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : ""}. Continua na equipe, mas fora das listas de presença.`
        : `${nome} foi reativado(a).${antes.status === "inativo" ? " Se for o caso, associe-o(a) novamente a uma equipe." : ""}`;

  return { ok: true, message };
}
