import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { getUsuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolverFiltros } from "@/lib/dashboard";
import { DIAS_SEMANA } from "@/lib/recorrencia";
import {
  planilhaAgenda,
  respostaXlsx,
  type LinhaAgenda,
} from "@/lib/exportar";
import { paramsDaUrl, sufixoPeriodo } from "../_util";

const STATUS_ROTULO: Record<string, string> = {
  agendado: "Agendado",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

// Agenda de eventos + escalas no período (respeita equipe/tipo dos filtros).
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return new Response("Não autenticado", { status: 401 });

  const filtros = resolverFiltros(usuario, paramsDaUrl(req));

  const where: Prisma.EventoWhereInput = {
    dataEvento: { gte: filtros.inicio, lte: filtros.fim },
    ...(filtros.tipoEventoId ? { tipoEventoId: filtros.tipoEventoId } : {}),
    // Escopo/filtro por equipe → só eventos onde a equipe está escalada.
    ...(filtros.equipeId
      ? { escalas: { some: { equipeId: filtros.equipeId } } }
      : {}),
  };

  const eventos = await prisma.evento.findMany({
    where,
    include: {
      tipoEvento: { select: { nome: true } },
      escalas: { include: { equipe: { select: { nome: true } } } },
    },
    orderBy: [{ dataEvento: "asc" }, { horarioInicio: "asc" }],
  });

  const linhas: LinhaAgenda[] = eventos.map((e) => ({
    dataBR: e.dataEvento.toLocaleDateString("pt-BR", { timeZone: "UTC" }),
    diaSemana: DIAS_SEMANA[e.dataEvento.getUTCDay()],
    evento: e.descricaoEspecifica ?? e.tipoEvento.nome,
    tipo: e.tipoEvento.nome,
    inicio: e.horarioInicio,
    chegada: e.horarioChegadaEquipe,
    status: STATUS_ROTULO[e.status] ?? e.status,
    equipes: e.escalas.map((s) => s.equipe.nome).join("; ") || "—",
  }));

  const buffer = await planilhaAgenda(linhas);
  return respostaXlsx(buffer, `agenda_${sufixoPeriodo(filtros)}.xlsx`);
}
