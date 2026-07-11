"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";
import type { TurnoEquipe } from "@prisma/client";

export type EstadoEquipe =
  | (NonNullable<EstadoAcao> & { equipeId?: string })
  | null;

const COR_RE = /^#[0-9a-fA-F]{6}$/;
const TURNOS: TurnoEquipe[] = ["manha", "noite", "variavel"];

function revalidarEquipes(id?: string) {
  revalidatePath("/equipes");
  if (id) revalidatePath(`/equipes/${id}`);
  revalidatePath("/membros"); // listas de membros mostram a equipe
}

// Cria ou atualiza uma equipe (nome, turno padrão, cor do calendário, status).
export async function salvarEquipe(
  _prev: EstadoEquipe,
  formData: FormData,
): Promise<EstadoEquipe> {
  const usuario = await requirePermissao("gerenciar_membros");

  const id = String(formData.get("id") ?? "").trim() || null;
  const nome = String(formData.get("nome") ?? "").trim();
  const turnoPadrao = String(formData.get("turnoPadrao") ?? "variavel") as TurnoEquipe;
  const corHex = String(formData.get("corHex") ?? "").trim();
  const status = String(formData.get("status") ?? "ativa");

  if (nome.length < 3) return falha("Informe o nome da equipe.");
  if (!TURNOS.includes(turnoPadrao)) return falha("Turno inválido.");
  if (corHex && !COR_RE.test(corHex)) return falha("Cor inválida (use #RRGGBB).");

  const dados = {
    nome,
    turnoPadrao,
    corHex: corHex || null,
    status: status === "inativa" ? ("inativa" as const) : ("ativa" as const),
  };

  try {
    let equipeId: string;
    if (id) {
      const antes = await prisma.equipe.findUnique({ where: { id } });
      if (!antes) return falha("Equipe não encontrada.");
      await prisma.equipe.update({ where: { id }, data: dados });
      equipeId = id;
      await writeAudit({
        usuarioId: usuario.membroId,
        acao: "editar",
        tabelaAfetada: "equipes",
        registroId: id,
        dadosAnteriores: {
          nome: antes.nome,
          turnoPadrao: antes.turnoPadrao,
          corHex: antes.corHex,
          status: antes.status,
        },
        dadosNovos: dados,
      });
    } else {
      const criada = await prisma.equipe.create({ data: dados });
      equipeId = criada.id;
      await writeAudit({
        usuarioId: usuario.membroId,
        acao: "criar",
        tabelaAfetada: "equipes",
        registroId: equipeId,
        dadosNovos: dados,
      });
    }

    revalidarEquipes(equipeId);
    return {
      ...sucesso(id ? "Equipe atualizada com sucesso." : "Equipe criada com sucesso.")!,
      equipeId,
    };
  } catch (erro) {
    return falha(
      `Erro ao salvar: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Vincula um membro como líder da equipe (EQUIPE_LIDERES com data_inicio).
// Se o membro tem nível "membro", é elevado a "lider" (auditado).
export async function adicionarLider(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_membros");
  const equipeId = String(formData.get("equipeId") ?? "");
  const membroId = String(formData.get("membroId") ?? "");
  if (!membroId) return falha("Selecione um membro.");

  try {
    const [equipe, membro, vinculoAtivo] = await Promise.all([
      prisma.equipe.findUnique({ where: { id: equipeId } }),
      prisma.membro.findUnique({ where: { id: membroId } }),
      prisma.equipeLider.findFirst({
        where: { equipeId, membroId, dataFim: null },
      }),
    ]);
    if (!equipe || !membro) return falha("Equipe ou membro não encontrado.");
    if (vinculoAtivo) return falha(`${membro.nomeCompleto} já é líder desta equipe.`);

    await prisma.equipeLider.create({ data: { equipeId, membroId } });

    if (membro.nivelAcesso === "membro") {
      await prisma.membro.update({
        where: { id: membroId },
        data: { nivelAcesso: "lider" },
      });
    }

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "criar",
      tabelaAfetada: "equipe_lideres",
      registroId: `${equipeId}:${membroId}`,
      dadosNovos: {
        equipe: equipe.nome,
        membro: membro.nomeCompleto,
        nivelElevado: membro.nivelAcesso === "membro",
      },
    });

    revalidarEquipes(equipeId);
    return sucesso(
      `${membro.nomeCompleto} agora é líder da equipe ${equipe.nome}.` +
        (membro.nivelAcesso === "membro" ? " Nível de acesso elevado a Líder." : ""),
    );
  } catch (erro) {
    return falha(
      `Erro ao adicionar líder: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Encerra a liderança (data_fim = hoje) — o histórico do vínculo é preservado.
// O nível de acesso não é rebaixado automaticamente (ajuste em Usuários).
export async function removerLider(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_membros");
  const vinculoId = String(formData.get("vinculoId") ?? "");

  try {
    const vinculo = await prisma.equipeLider.findUnique({
      where: { id: vinculoId },
      include: { membro: { select: { nomeCompleto: true } }, equipe: { select: { nome: true } } },
    });
    if (!vinculo || vinculo.dataFim) return falha("Vínculo de liderança não encontrado.");

    await prisma.equipeLider.update({
      where: { id: vinculoId },
      data: { dataFim: new Date() },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "editar",
      tabelaAfetada: "equipe_lideres",
      registroId: vinculoId,
      dadosAnteriores: { dataFim: null },
      dadosNovos: { dataFim: new Date().toISOString() },
    });

    revalidarEquipes(vinculo.equipeId);
    return sucesso(
      `${vinculo.membro.nomeCompleto} deixou a liderança da equipe ${vinculo.equipe.nome}.`,
    );
  } catch (erro) {
    return falha(
      `Erro ao remover líder: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Coloca um membro na equipe. Como cada membro tem UMA equipe ativa por vez,
// se ele estiver em outra equipe o vínculo é MOVIDO (o cliente avisa antes).
export async function adicionarMembroEquipe(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_membros");
  const equipeId = String(formData.get("equipeId") ?? "");
  const membroId = String(formData.get("membroId") ?? "");
  if (!membroId) return falha("Selecione um membro.");

  try {
    const [equipe, membro] = await Promise.all([
      prisma.equipe.findUnique({ where: { id: equipeId } }),
      prisma.membro.findUnique({
        where: { id: membroId },
        include: { equipe: { select: { nome: true } } },
      }),
    ]);
    if (!equipe || !membro) return falha("Equipe ou membro não encontrado.");
    if (membro.equipeId === equipeId) {
      return falha(`${membro.nomeCompleto} já está nesta equipe.`);
    }

    const equipeAnterior = membro.equipe?.nome ?? null;
    await prisma.membro.update({ where: { id: membroId }, data: { equipeId } });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "editar",
      tabelaAfetada: "membros",
      registroId: membroId,
      dadosAnteriores: { equipeId: membro.equipeId, equipe: equipeAnterior },
      dadosNovos: { equipeId, equipe: equipe.nome },
    });

    revalidarEquipes(equipeId);
    return sucesso(
      equipeAnterior
        ? `${membro.nomeCompleto} foi movido(a) de "${equipeAnterior}" para "${equipe.nome}".`
        : `${membro.nomeCompleto} entrou na equipe ${equipe.nome}.`,
    );
  } catch (erro) {
    return falha(
      `Erro ao adicionar membro: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Tira o membro da equipe (fica "sem equipe" — o cadastro permanece ativo).
export async function removerMembroEquipe(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_membros");
  const equipeId = String(formData.get("equipeId") ?? "");
  const membroId = String(formData.get("membroId") ?? "");

  try {
    const membro = await prisma.membro.findUnique({ where: { id: membroId } });
    if (!membro || membro.equipeId !== equipeId) {
      return falha("Membro não encontrado nesta equipe.");
    }

    await prisma.membro.update({ where: { id: membroId }, data: { equipeId: null } });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "editar",
      tabelaAfetada: "membros",
      registroId: membroId,
      dadosAnteriores: { equipeId },
      dadosNovos: { equipeId: null },
    });

    revalidarEquipes(equipeId);
    return sucesso(`${membro.nomeCompleto} saiu da equipe.`);
  } catch (erro) {
    return falha(
      `Erro ao remover membro: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}
