"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";
import { horarioValido } from "@/lib/recorrencia";
import type { UsuarioAtual } from "@/lib/auth";
import type { Pontualidade } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────
// Server Actions — Registro de presença (Etapa 4).
//
// Regra de "excluído": um lançamento está excluído ⟺ `excluidoEm !== null`.
// Ao restaurar, LIMPAMOS `excluidoEm` (voltando o registro ao índice único
// parcial `presenca_evento_equipe_membro_ativo_key`, que só cobre linhas com
// `excluido_em IS NULL`) e preenchemos `restauradoEm`/`restauradoPor` para
// manter a autoria do restauro na própria linha. O histórico completo de quem
// excluiu/restaurou e por quê fica na trilha de auditoria (AuditLog).
// ─────────────────────────────────────────────────────────────────────────

function revalidar() {
  revalidatePath("/presenca");
}

// Garante que um líder (sem `registrar_presenca_qualquer`) só toque na própria
// equipe. Nunca confia no equipeId vindo do formulário. Retorna mensagem de
// erro (para `falha`) ou null se autorizado.
function checarEquipe(usuario: UsuarioAtual, equipeId: string): string | null {
  if (can(usuario.nivelAcesso, "registrar_presenca_qualquer")) return null;
  if (!usuario.equipeId) {
    return "Você não está vinculado a uma equipe.";
  }
  if (equipeId !== usuario.equipeId) {
    return "Você só pode registrar presença da sua própria equipe.";
  }
  return null;
}

function resumoPresenca(p: {
  presente: boolean;
  pontualidade: Pontualidade | null;
  horarioChegada: string | null;
  justificativaAusencia: string | null;
}) {
  return {
    presente: p.presente,
    pontualidade: p.pontualidade,
    horarioChegada: p.horarioChegada,
    justificativaAusencia: p.justificativaAusencia,
  };
}

// Payload do salvamento automático (a lista salva sozinha após um tempo de
// inatividade — sem botão por membro). Mesmas validações do fluxo antigo.
export type DadosPresencaAuto = {
  eventoId: string;
  equipeId: string;
  membroId: string;
  presente: boolean;
  pontualidade: "pontual" | "atrasado";
  horarioChegada: string; // "HH:MM" ou ""
  justificativa: string;
};

// Resultado do auto-save: sem popup — a linha mostra "salvo/erro" discreto.
// `presencaId` permite excluir um lançamento recém-criado sem recarregar.
export type ResultadoPresenca = {
  ok: boolean;
  message: string;
  presencaId: string | null;
};

// Cria ou atualiza o lançamento de presença de um membro num evento/equipe.
// Se já existe lançamento ativo (não excluído), faz UPDATE; senão, CREATE.
export async function salvarPresencaAuto(
  dados: DadosPresencaAuto,
): Promise<ResultadoPresenca> {
  const usuario = await requirePermissao("registrar_presenca_propria");

  const eventoId = String(dados.eventoId ?? "").trim();
  const equipeId = String(dados.equipeId ?? "").trim();
  const membroId = String(dados.membroId ?? "").trim();
  const presente = dados.presente === true;
  const pontualidadeRaw = String(dados.pontualidade ?? "").trim();
  const horarioChegada = String(dados.horarioChegada ?? "").trim();
  const justificativa = String(dados.justificativa ?? "").trim();

  const erro = (message: string): ResultadoPresenca => ({
    ok: false,
    message,
    presencaId: null,
  });

  if (!eventoId || !equipeId || !membroId) {
    return erro("Dados incompletos para registrar a presença.");
  }

  const erroEquipe = checarEquipe(usuario, equipeId);
  if (erroEquipe) return erro(erroEquipe);

  // Normaliza os campos conforme presente/ausente.
  let pontualidade: Pontualidade | null = null;
  let horario: string | null = null;
  let justificativaAusencia: string | null = null;

  if (presente) {
    if (pontualidadeRaw !== "pontual" && pontualidadeRaw !== "atrasado") {
      return erro("Selecione a pontualidade (pontual ou atrasado).");
    }
    pontualidade = pontualidadeRaw as Pontualidade;
    if (horarioChegada) {
      if (!horarioValido(horarioChegada)) {
        return erro("Horário de chegada inválido (use HH:MM).");
      }
      horario = horarioChegada;
    }
  } else {
    justificativaAusencia = justificativa || null;
  }

  try {
    // Validação de domínio: evento existe, equipe está escalada nele e o membro
    // pertence à equipe e está ativo.
    const [evento, membro] = await Promise.all([
      prisma.evento.findUnique({
        where: { id: eventoId },
        include: {
          escalas: {
            select: {
              equipeId: true,
              membrosEscalados: { select: { membroId: true } },
            },
          },
        },
      }),
      prisma.membro.findUnique({ where: { id: membroId } }),
    ]);
    if (!evento) return erro("Evento não encontrado.");
    if (evento.status === "cancelado") {
      return erro("Este evento está cancelado — não é possível registrar presença.");
    }
    const escalaEquipe = evento.escalas.find((e) => e.equipeId === equipeId);
    if (!escalaEquipe) {
      return erro("Esta equipe não está escalada neste evento.");
    }
    if (!membro || membro.equipeId !== equipeId) {
      return erro("Membro não pertence a esta equipe.");
    }
    // Escala parcial: só quem foi convocado pode ter presença lançada.
    if (
      escalaEquipe.membrosEscalados.length > 0 &&
      !escalaEquipe.membrosEscalados.some((m) => m.membroId === membroId)
    ) {
      return erro("Este membro não foi convocado para este evento.");
    }
    if (membro.status !== "ativo") {
      return erro(
        membro.status === "afastado"
          ? "Membro afastado — não recebe lançamentos de presença no período."
          : "Membro inativo — não recebe lançamentos de presença.",
      );
    }

    const existente = await prisma.presenca.findFirst({
      where: { eventoId, equipeId, membroId, excluidoEm: null },
    });

    if (existente) {
      const atualizada = await prisma.presenca.update({
        where: { id: existente.id },
        data: {
          presente,
          pontualidade,
          horarioChegada: horario,
          justificativaAusencia,
          editadoEm: new Date(),
          editadoPor: usuario.membroId,
        },
      });
      await writeAudit({
        usuarioId: usuario.membroId,
        acao: "editar",
        tabelaAfetada: "presenca",
        registroId: atualizada.id,
        dadosAnteriores: resumoPresenca(existente),
        dadosNovos: resumoPresenca(atualizada),
      });
      revalidar();
      return {
        ok: true,
        message: `Presença de ${membro.nomeCompleto} atualizada.`,
        presencaId: atualizada.id,
      };
    }

    const criada = await prisma.presenca.create({
      data: {
        eventoId,
        equipeId,
        membroId,
        presente,
        pontualidade,
        horarioChegada: horario,
        justificativaAusencia,
        registradoPor: usuario.membroId,
      },
    });
    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "criar",
      tabelaAfetada: "presenca",
      registroId: criada.id,
      dadosNovos: resumoPresenca(criada),
    });
    revalidar();
    return {
      ok: true,
      message: presente
        ? `${membro.nomeCompleto} registrado(a) como presente.`
        : `${membro.nomeCompleto} registrado(a) como ausente.`,
      presencaId: criada.id,
    };
  } catch (excecao) {
    // Rede de segurança: o índice único parcial impede um 2º lançamento ativo.
    if (
      excecao instanceof Prisma.PrismaClientKnownRequestError &&
      excecao.code === "P2002"
    ) {
      return erro(
        "Já existe um lançamento ativo para este membro. Recarregue a página para editá-lo.",
      );
    }
    return erro(
      `Erro ao registrar presença: ${excecao instanceof Error ? excecao.message : "falha desconhecida"}`,
    );
  }
}

// Exclusão lógica: exige motivo, marca excluidoEm/excluidoPor/motivoExclusao.
export async function excluirPresenca(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("registrar_presenca_propria");

  const presencaId = String(formData.get("presencaId") ?? "").trim();
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!presencaId) return falha("Lançamento não informado.");
  if (!motivo) return falha("Informe o motivo da exclusão.");

  try {
    const presenca = await prisma.presenca.findUnique({
      where: { id: presencaId },
      include: { membro: { select: { nomeCompleto: true } } },
    });
    if (!presenca) return falha("Lançamento não encontrado.");

    const erroEquipe = checarEquipe(usuario, presenca.equipeId);
    if (erroEquipe) return falha(erroEquipe);

    if (presenca.excluidoEm) {
      return falha("Este lançamento já está excluído.");
    }

    await prisma.presenca.update({
      where: { id: presencaId },
      data: {
        excluidoEm: new Date(),
        excluidoPor: usuario.membroId,
        motivoExclusao: motivo,
        // Zera o restauro anterior (se houver) para manter a regra
        // "excluído ⟺ excluidoEm !== null" consistente.
        restauradoEm: null,
        restauradoPor: null,
      },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "excluir",
      tabelaAfetada: "presenca",
      registroId: presencaId,
      dadosAnteriores: resumoPresenca(presenca),
      dadosNovos: { motivoExclusao: motivo },
    });

    revalidar();
    return sucesso(
      `Lançamento de ${presenca.membro.nomeCompleto} excluído. Pode ser restaurado a qualquer momento.`,
    );
  } catch (erro) {
    return falha(
      `Erro ao excluir: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Restaura um lançamento excluído (limpa a exclusão e registra o restauro).
export async function restaurarPresenca(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("registrar_presenca_propria");

  const presencaId = String(formData.get("presencaId") ?? "").trim();
  if (!presencaId) return falha("Lançamento não informado.");

  try {
    const presenca = await prisma.presenca.findUnique({
      where: { id: presencaId },
      include: { membro: { select: { nomeCompleto: true } } },
    });
    if (!presenca) return falha("Lançamento não encontrado.");

    const erroEquipe = checarEquipe(usuario, presenca.equipeId);
    if (erroEquipe) return falha(erroEquipe);

    if (!presenca.excluidoEm) {
      return falha("Este lançamento não está excluído.");
    }

    // Não pode existir outro lançamento ativo do mesmo membro/evento/equipe,
    // senão o restauro violaria o índice único parcial.
    const ativoExistente = await prisma.presenca.findFirst({
      where: {
        eventoId: presenca.eventoId,
        equipeId: presenca.equipeId,
        membroId: presenca.membroId,
        excluidoEm: null,
      },
    });
    if (ativoExistente) {
      return falha(
        "Já existe um lançamento ativo para este membro — exclua-o antes de restaurar este.",
      );
    }

    await prisma.presenca.update({
      where: { id: presencaId },
      data: {
        excluidoEm: null,
        excluidoPor: null,
        motivoExclusao: null,
        restauradoEm: new Date(),
        restauradoPor: usuario.membroId,
      },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "restaurar",
      tabelaAfetada: "presenca",
      registroId: presencaId,
      dadosAnteriores: { excluidoEm: presenca.excluidoEm.toISOString() },
      dadosNovos: resumoPresenca(presenca),
    });

    revalidar();
    return sucesso(
      `Lançamento de ${presenca.membro.nomeCompleto} restaurado.`,
    );
  } catch (erro) {
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2002"
    ) {
      return falha(
        "Já existe um lançamento ativo para este membro. Recarregue a página.",
      );
    }
    return falha(
      `Erro ao restaurar: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}
