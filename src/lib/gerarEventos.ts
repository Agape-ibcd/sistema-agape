import "server-only";
import { prisma } from "@/lib/prisma";
import {
  gerarDatas,
  validarConfig,
  type ConfigRecorrencia,
} from "@/lib/recorrencia";

// ─────────────────────────────────────────────────────────────────────────
// Geração de instâncias de eventos a partir dos tipos recorrentes.
// Janela padrão: hoje + 3 meses (renovável — basta rodar de novo).
// Idempotente por consulta: qualquer evento já existente do tipo naquela
// data (inclusive editado, cancelado ou um avulso extra do mesmo tipo)
// bloqueia a geração para o dia. Não há mais unique (tipo, data) no banco —
// eventos extras podem repetir o tipo no mesmo dia.
// ─────────────────────────────────────────────────────────────────────────

export const JANELA_MESES = 3;

export type ResultadoGeracao = {
  tipoNome: string;
  criados: number;
  jaExistiam: number;
  erro?: string;
};

function hojeUTC(): Date {
  const agora = new Date();
  return new Date(
    Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()),
  );
}

function somarMeses(d: Date, meses: number): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, d.getUTCDate()),
  );
}

// Gera as instâncias dos próximos 3 meses para um tipo específico ou para
// todos os tipos ativos (tipoEventoId omitido). Tipos "avulso" não geram.
export async function gerarInstanciasEventos(opcoes: {
  tipoEventoId?: string;
  criadoPor: string;
}): Promise<ResultadoGeracao[]> {
  const inicio = hojeUTC();
  const fim = somarMeses(inicio, JANELA_MESES);

  const tipos = await prisma.tipoEvento.findMany({
    where: {
      ativo: true,
      tipoRecorrencia: { not: "avulso" },
      ...(opcoes.tipoEventoId ? { id: opcoes.tipoEventoId } : {}),
    },
    orderBy: { nome: "asc" },
  });

  const resultados: ResultadoGeracao[] = [];

  for (const tipo of tipos) {
    const config = (tipo.configRecorrencia ?? {}) as ConfigRecorrencia;
    const erroConfig = validarConfig(tipo.tipoRecorrencia, config);
    if (erroConfig) {
      resultados.push({
        tipoNome: tipo.nome,
        criados: 0,
        jaExistiam: 0,
        erro: `recorrência não configurada (${erroConfig.toLowerCase()})`,
      });
      continue;
    }

    const datas = gerarDatas(tipo.tipoRecorrencia, config, inicio, fim);
    if (datas.length === 0) {
      resultados.push({ tipoNome: tipo.nome, criados: 0, jaExistiam: 0 });
      continue;
    }

    const existentes = await prisma.evento.findMany({
      where: {
        tipoEventoId: tipo.id,
        dataEvento: { gte: inicio, lte: fim },
      },
      select: { dataEvento: true },
    });
    const datasOcupadas = new Set(
      existentes.map((e) => e.dataEvento.toISOString().slice(0, 10)),
    );
    const novas = datas.filter(
      (d) => !datasOcupadas.has(d.toISOString().slice(0, 10)),
    );

    const { count } = novas.length
      ? await prisma.evento.createMany({
          data: novas.map((dataEvento) => ({
            tipoEventoId: tipo.id,
            dataEvento,
            horarioInicio: tipo.horarioInicio,
            horarioChegadaEquipe: tipo.horarioChegadaEquipe,
            geradoAutomaticamente: true,
            criadoPor: opcoes.criadoPor,
          })),
        })
      : { count: 0 };

    resultados.push({
      tipoNome: tipo.nome,
      criados: count,
      jaExistiam: datas.length - count,
    });
  }

  return resultados;
}
