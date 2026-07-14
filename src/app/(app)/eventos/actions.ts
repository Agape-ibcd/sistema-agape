"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";
import {
  calcularHorarioChegada,
  horarioValido,
  parseDataISO,
} from "@/lib/recorrencia";
import { aplicarRodizioNoBanco } from "@/lib/aplicarRodizio";
import type { TipoEscala } from "@prisma/client";

// Estado da ação de escalar: quando a equipe é escalada num evento e existem
// outros eventos AGENDADOS na mesma semana sem essa equipe, devolve a
// pergunta de propagação (regra de cobertura semanal do PDF).
export type EstadoEscala =
  | (NonNullable<EstadoAcao> & {
      propagacao?: {
        equipeId: string;
        equipeNome: string;
        eventos: { id: string; rotulo: string }[];
      };
    })
  | null;

function revalidarCalendario(eventoId?: string) {
  revalidatePath("/eventos");
  if (eventoId) revalidatePath(`/eventos/${eventoId}`);
}

// Semana civil (domingo a sábado) que contém a data — janela da cobertura.
function janelaDaSemana(data: Date): { inicio: Date; fim: Date } {
  const inicio = new Date(data.getTime() - data.getUTCDay() * 86_400_000);
  const fim = new Date(inicio.getTime() + 6 * 86_400_000);
  return { inicio, fim };
}

function rotuloEvento(e: {
  dataEvento: Date;
  horarioInicio: string;
  tipoEvento: { nome: string };
  descricaoEspecifica: string | null;
}): string {
  const data = e.dataEvento.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
  return `${data} ${e.horarioInicio} — ${e.descricaoEspecifica ?? e.tipoEvento.nome}`;
}

// Escala uma equipe num evento (regular ou especial). Se houver outros eventos
// da mesma semana sem a equipe, devolve a pergunta de propagação ao cliente.
export async function escalarEquipe(
  _prev: EstadoEscala,
  formData: FormData,
): Promise<EstadoEscala> {
  const usuario = await requirePermissao("gerenciar_escalas");
  const eventoId = String(formData.get("eventoId") ?? "");
  const equipeId = String(formData.get("equipeId") ?? "");
  const tipoEscala = (String(formData.get("tipoEscala") ?? "regular") === "especial"
    ? "especial"
    : "regular") as TipoEscala;
  const observacao = String(formData.get("observacao") ?? "").trim();

  if (!equipeId) return falha("Selecione uma equipe.");

  try {
    const [evento, equipe] = await Promise.all([
      prisma.evento.findUnique({ where: { id: eventoId }, include: { tipoEvento: true } }),
      prisma.equipe.findUnique({ where: { id: equipeId } }),
    ]);
    if (!evento || !equipe) return falha("Evento ou equipe não encontrado.");
    if (evento.status === "cancelado") {
      return falha("Este evento está cancelado — reative-o antes de escalar.");
    }

    await prisma.escalaEquipeEvento.create({
      data: {
        eventoId,
        equipeId,
        tipoEscala,
        observacao: observacao || null,
        criadoPor: usuario.membroId,
      },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "criar",
      tabelaAfetada: "escala_equipe_evento",
      registroId: `${eventoId}:${equipeId}`,
      dadosNovos: {
        evento: rotuloEvento(evento),
        equipe: equipe.nome,
        tipoEscala,
        observacao: observacao || null,
      },
    });

    revalidarCalendario(eventoId);

    // Cobertura semanal: procura eventos agendados da mesma semana sem a equipe.
    const { inicio, fim } = janelaDaSemana(evento.dataEvento);
    const eventosSemana = await prisma.evento.findMany({
      where: {
        id: { not: eventoId },
        status: "agendado",
        dataEvento: { gte: inicio, lte: fim },
        escalas: { none: { equipeId } },
      },
      include: { tipoEvento: { select: { nome: true } } },
      orderBy: [{ dataEvento: "asc" }, { horarioInicio: "asc" }],
    });

    const base = sucesso(`Equipe ${equipe.nome} escalada com sucesso.`)!;
    if (tipoEscala === "regular" && eventosSemana.length > 0) {
      return {
        ...base,
        propagacao: {
          equipeId,
          equipeNome: equipe.nome,
          eventos: eventosSemana.map((e) => ({ id: e.id, rotulo: rotuloEvento(e) })),
        },
      };
    }
    return base;
  } catch (erro) {
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2002"
    ) {
      return falha("Esta equipe já está escalada neste evento.");
    }
    return falha(
      `Erro ao escalar: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Propaga a escala para os demais eventos da semana (tipo "cobertura").
export async function propagarEscala(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_escalas");
  const equipeId = String(formData.get("equipeId") ?? "");
  const eventoIds = formData
    .getAll("eventoIds")
    .map(String)
    .filter(Boolean);

  if (!equipeId || eventoIds.length === 0) {
    return falha("Nada a propagar.");
  }

  try {
    const equipe = await prisma.equipe.findUnique({ where: { id: equipeId } });
    if (!equipe) return falha("Equipe não encontrada.");

    // Revalida no servidor: só eventos agendados e ainda sem a equipe.
    const eventos = await prisma.evento.findMany({
      where: {
        id: { in: eventoIds },
        status: "agendado",
        escalas: { none: { equipeId } },
      },
      select: { id: true },
    });

    const { count } = await prisma.escalaEquipeEvento.createMany({
      data: eventos.map((e) => ({
        eventoId: e.id,
        equipeId,
        tipoEscala: "cobertura" as const,
        criadoPor: usuario.membroId,
      })),
      skipDuplicates: true,
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "criar",
      tabelaAfetada: "escala_equipe_evento",
      registroId: `propagacao:${equipeId}`,
      dadosNovos: { equipe: equipe.nome, eventos: eventos.map((e) => e.id), criados: count },
    });

    revalidarCalendario();
    return sucesso(
      `Escala propagada: equipe ${equipe.nome} escalada em mais ${count} evento(s) da semana.`,
    );
  } catch (erro) {
    return falha(
      `Erro ao propagar: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Remove uma escala do evento (a exclusão é auditada com os dados anteriores).
export async function removerEscala(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_escalas");
  const escalaId = String(formData.get("escalaId") ?? "");

  try {
    const escala = await prisma.escalaEquipeEvento.findUnique({
      where: { id: escalaId },
      include: {
        equipe: { select: { nome: true } },
        evento: { include: { tipoEvento: { select: { nome: true } } } },
      },
    });
    if (!escala) return falha("Escala não encontrada.");

    await prisma.escalaEquipeEvento.delete({ where: { id: escalaId } });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "excluir",
      tabelaAfetada: "escala_equipe_evento",
      registroId: escalaId,
      dadosAnteriores: {
        evento: rotuloEvento(escala.evento),
        equipe: escala.equipe.nome,
        tipoEscala: escala.tipoEscala,
        observacao: escala.observacao,
      },
    });

    revalidarCalendario(escala.eventoId);
    return sucesso(`Equipe ${escala.equipe.nome} removida da escala.`);
  } catch (erro) {
    return falha(
      `Erro ao remover escala: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Cria um evento avulso/extra (campanhas, conferências, eventos especiais).
export type EstadoEvento =
  | (NonNullable<EstadoAcao> & { eventoId?: string })
  | null;

export async function criarEventoAvulso(
  _prev: EstadoEvento,
  formData: FormData,
): Promise<EstadoEvento> {
  const usuario = await requirePermissao("criar_eventos_extras");

  const tipoEventoId = String(formData.get("tipoEventoId") ?? "");
  const dataStr = String(formData.get("dataEvento") ?? "").trim();
  const horarioInicio = String(formData.get("horarioInicio") ?? "").trim();
  const descricao = String(formData.get("descricaoEspecifica") ?? "").trim();

  if (!tipoEventoId) return falha("Selecione o tipo de evento.");
  const dataEvento = parseDataISO(dataStr);
  if (!dataEvento) return falha("Informe a data do evento.");
  if (!horarioValido(horarioInicio)) return falha("Informe o horário de início.");

  try {
    const tipo = await prisma.tipoEvento.findUnique({ where: { id: tipoEventoId } });
    if (!tipo) return falha("Tipo de evento não encontrado.");

    const criado = await prisma.evento.create({
      data: {
        tipoEventoId,
        dataEvento,
        horarioInicio,
        horarioChegadaEquipe: calcularHorarioChegada(horarioInicio),
        descricaoEspecifica: descricao || null,
        geradoAutomaticamente: false,
        criadoPor: usuario.membroId,
      },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "criar",
      tabelaAfetada: "eventos",
      registroId: criado.id,
      dadosNovos: {
        tipo: tipo.nome,
        dataEvento: dataStr,
        horarioInicio,
        descricaoEspecifica: descricao || null,
      },
    });

    // Rodízio ativo? Já escala as equipes da semana neste evento (o usuário
    // pode trocar por uma escala específica na página do evento).
    const rodizio = await aplicarRodizioNoBanco({
      usuarioId: usuario.membroId,
      eventoIds: [criado.id],
    });

    revalidarCalendario(criado.id);
    return {
      ...sucesso(
        rodizio && rodizio.criadas > 0
          ? `Evento criado. Rodízio aplicou ${rodizio.criadas} escala(s) da semana — ajuste na página do evento se precisar.`
          : "Evento criado com sucesso.",
      )!,
      eventoId: criado.id,
    };
  } catch (erro) {
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2002"
    ) {
      return falha("Já existe um evento deste tipo nesta data — edite o existente.");
    }
    return falha(
      `Erro ao criar evento: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Edita horário/descrição de um evento (instância) — a chegada é recalculada.
export async function salvarEvento(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_escalas");
  const id = String(formData.get("id") ?? "");
  const horarioInicio = String(formData.get("horarioInicio") ?? "").trim();
  const descricao = String(formData.get("descricaoEspecifica") ?? "").trim();

  if (!horarioValido(horarioInicio)) return falha("Informe o horário de início.");

  try {
    const antes = await prisma.evento.findUnique({ where: { id } });
    if (!antes) return falha("Evento não encontrado.");

    const horarioChegadaEquipe = calcularHorarioChegada(horarioInicio);
    await prisma.evento.update({
      where: { id },
      data: {
        horarioInicio,
        horarioChegadaEquipe,
        descricaoEspecifica: descricao || null,
      },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "editar",
      tabelaAfetada: "eventos",
      registroId: id,
      dadosAnteriores: {
        horarioInicio: antes.horarioInicio,
        descricaoEspecifica: antes.descricaoEspecifica,
      },
      dadosNovos: { horarioInicio, descricaoEspecifica: descricao || null },
    });

    revalidarCalendario(id);
    return sucesso(
      `Evento atualizado (chegada da equipe recalculada: ${horarioChegadaEquipe}).`,
    );
  } catch (erro) {
    return falha(
      `Erro ao salvar: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Cancela ou reativa um evento (status agendado ⇄ cancelado, nunca exclusão).
export async function alternarStatusEvento(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_escalas");
  const id = String(formData.get("id") ?? "");

  try {
    const antes = await prisma.evento.findUnique({
      where: { id },
      include: { tipoEvento: { select: { nome: true } } },
    });
    if (!antes) return falha("Evento não encontrado.");
    if (antes.status === "realizado") {
      return falha("Evento já realizado não pode ser cancelado.");
    }

    const novoStatus = antes.status === "cancelado" ? "agendado" : "cancelado";
    await prisma.evento.update({ where: { id }, data: { status: novoStatus } });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: novoStatus === "cancelado" ? "cancelar" : "reativar",
      tabelaAfetada: "eventos",
      registroId: id,
      dadosAnteriores: { status: antes.status },
      dadosNovos: { status: novoStatus },
    });

    revalidarCalendario(id);
    return sucesso(
      novoStatus === "cancelado"
        ? "Evento cancelado. As escalas ficam registradas, mas o evento sai do fluxo de presença."
        : "Evento reativado (agendado).",
    );
  } catch (erro) {
    return falha(
      `Erro ao alterar status: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Troca a equipe de uma escala existente (remover + escalar em uma transação).
// Bloqueia se a equipe atual já tem lançamentos ativos de presença no evento —
// nesse caso o certo é excluí-los antes, ou escalar a nova equipe em paralelo.
export async function trocarEscala(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_escalas");
  const escalaId = String(formData.get("escalaId") ?? "");
  const novaEquipeId = String(formData.get("novaEquipeId") ?? "");
  if (!novaEquipeId) return falha("Selecione a nova equipe.");

  try {
    const escala = await prisma.escalaEquipeEvento.findUnique({
      where: { id: escalaId },
      include: {
        equipe: { select: { nome: true } },
        evento: { select: { id: true, status: true } },
      },
    });
    if (!escala) return falha("Escala não encontrada.");
    if (escala.evento.status === "cancelado") {
      return falha("Evento cancelado — reative-o para alterar a escala.");
    }
    if (novaEquipeId === escala.equipeId) {
      return falha("A nova equipe é a mesma que já está escalada.");
    }

    const nova = await prisma.equipe.findUnique({ where: { id: novaEquipeId } });
    if (!nova || nova.status !== "ativa") {
      return falha("Equipe não encontrada ou inativa.");
    }

    const jaEscalada = await prisma.escalaEquipeEvento.findFirst({
      where: { eventoId: escala.eventoId, equipeId: novaEquipeId },
    });
    if (jaEscalada) {
      return falha(`${nova.nome} já está escalada neste evento.`);
    }

    const presencasAtivas = await prisma.presenca.count({
      where: {
        eventoId: escala.eventoId,
        equipeId: escala.equipeId,
        excluidoEm: null,
      },
    });
    if (presencasAtivas > 0) {
      return falha(
        `Há ${presencasAtivas} lançamento(s) de presença da equipe ${escala.equipe.nome} neste evento. Exclua-os antes de trocar — ou escale a nova equipe em paralelo, sem remover a atual.`,
      );
    }

    await prisma.$transaction([
      prisma.escalaEquipeEvento.delete({ where: { id: escalaId } }),
      prisma.escalaEquipeEvento.create({
        data: {
          eventoId: escala.eventoId,
          equipeId: novaEquipeId,
          tipoEscala: escala.tipoEscala,
          origem: "manual", // troca feita por pessoa → evento vira personalizado
          observacao: escala.observacao,
          criadoPor: usuario.membroId,
        },
      }),
    ]);

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "trocar_escala",
      tabelaAfetada: "escala_equipe_evento",
      registroId: escalaId,
      dadosAnteriores: { eventoId: escala.eventoId, equipe: escala.equipe.nome },
      dadosNovos: { eventoId: escala.eventoId, equipe: nova.nome },
    });

    revalidarCalendario(escala.eventoId);
    revalidatePath("/presenca");
    return sucesso(
      `Escala alterada: ${escala.equipe.nome} → ${nova.nome}.`,
    );
  } catch (erro) {
    return falha(
      `Erro ao trocar a escala: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}
