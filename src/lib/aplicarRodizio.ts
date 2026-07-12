import "server-only";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import {
  planejarRodizio,
  type ConfigRodizio,
  type EntradaCiclo,
  type EventoParaRodizio,
  type PlanoRodizio,
} from "@/lib/rodizio";

// ─────────────────────────────────────────────────────────────────────────
// Aplicação do rodízio no banco. Carrega a configuração ativa, monta o plano
// (puro, em src/lib/rodizio.ts) e executa numa transação. Reutilizada por:
//   • a tela /eventos/rodizio (botão "Aplicar rodízio");
//   • a geração de instâncias ("Gerar eventos" nos tipos);
//   • a criação de evento avulso (escala as equipes da semana na hora).
// ─────────────────────────────────────────────────────────────────────────

export type ConfigRodizioSalva = ConfigRodizio & {
  id: string;
  ativo: boolean;
};

// Lê a linha de configuração (singleton lógico). `null` se nunca configurado.
export async function lerConfigRodizio(): Promise<ConfigRodizioSalva | null> {
  const linha = await prisma.rodizioEscala.findFirst({
    orderBy: { dataCriacao: "asc" },
  });
  if (!linha) return null;
  const ciclo = Array.isArray(linha.ciclo)
    ? (linha.ciclo as EntradaCiclo[])
    : [];
  return {
    id: linha.id,
    ativo: linha.ativo,
    semanaAncora: linha.semanaAncora,
    ciclo,
  };
}

export type ResultadoRodizio = Omit<PlanoRodizio, "criar" | "removerEscalaIds"> & {
  criadas: number;
  removidas: number;
  totalEventos: number;
};

// Aplica o rodízio aos eventos do intervalo OU à lista de ids informada.
// Retorna null quando não há configuração ativa (chamador decide a mensagem).
export async function aplicarRodizioNoBanco(opcoes: {
  usuarioId: string;
  inicio?: Date;
  fim?: Date;
  eventoIds?: string[];
}): Promise<ResultadoRodizio | null> {
  const config = await lerConfigRodizio();
  if (!config || !config.ativo || config.ciclo.length === 0) return null;

  const where = opcoes.eventoIds
    ? { id: { in: opcoes.eventoIds } }
    : {
        dataEvento: {
          ...(opcoes.inicio ? { gte: opcoes.inicio } : {}),
          ...(opcoes.fim ? { lte: opcoes.fim } : {}),
        },
      };

  const eventos = await prisma.evento.findMany({
    where,
    include: {
      tipoEvento: { select: { nome: true } },
      escalas: { select: { id: true, equipeId: true, origem: true } },
    },
    orderBy: [{ dataEvento: "asc" }, { horarioInicio: "asc" }],
  });
  if (eventos.length === 0) {
    return {
      criadas: 0,
      removidas: 0,
      totalEventos: 0,
      eventosAlterados: 0,
      eventosJaCorretos: 0,
      eventosPersonalizados: 0,
      eventosForaDeEscopo: 0,
      avisos: [],
    };
  }

  // Presenças ativas por (evento, equipe) — trava a remoção de escala usada.
  const presencas = await prisma.presenca.groupBy({
    by: ["eventoId", "equipeId"],
    where: { eventoId: { in: eventos.map((e) => e.id) }, excluidoEm: null },
  });
  const comPresenca = new Set(presencas.map((p) => `${p.eventoId}:${p.equipeId}`));

  const entrada: EventoParaRodizio[] = eventos.map((e) => ({
    id: e.id,
    rotulo: `${e.dataEvento.toLocaleDateString("pt-BR", { timeZone: "UTC" })} ${e.horarioInicio} ${e.descricaoEspecifica ?? e.tipoEvento.nome}`,
    dataEvento: e.dataEvento,
    horarioInicio: e.horarioInicio,
    status: e.status,
    escalas: e.escalas.map((s) => ({
      id: s.id,
      equipeId: s.equipeId,
      origem: s.origem,
      temPresenca: comPresenca.has(`${e.id}:${s.equipeId}`),
    })),
  }));

  const plano = planejarRodizio(config, entrada);

  const [removidas, criadas] = await prisma.$transaction([
    prisma.escalaEquipeEvento.deleteMany({
      where: { id: { in: plano.removerEscalaIds } },
    }),
    prisma.escalaEquipeEvento.createMany({
      data: plano.criar.map((c) => ({
        eventoId: c.eventoId,
        equipeId: c.equipeId,
        tipoEscala: c.tipoEscala,
        origem: "rodizio" as const,
        criadoPor: opcoes.usuarioId,
      })),
      skipDuplicates: true,
    }),
  ]);

  if (criadas.count > 0 || removidas.count > 0) {
    await writeAudit({
      usuarioId: opcoes.usuarioId,
      acao: "aplicar_rodizio",
      tabelaAfetada: "escala_equipe_evento",
      registroId: `rodizio:${config.id}`,
      dadosNovos: {
        criadas: criadas.count,
        removidas: removidas.count,
        eventosAlterados: plano.eventosAlterados,
        eventosPersonalizados: plano.eventosPersonalizados,
        avisos: plano.avisos,
      },
    });
  }

  return {
    criadas: criadas.count,
    removidas: removidas.count,
    totalEventos: eventos.length,
    eventosAlterados: plano.eventosAlterados,
    eventosJaCorretos: plano.eventosJaCorretos,
    eventosPersonalizados: plano.eventosPersonalizados,
    eventosForaDeEscopo: plano.eventosForaDeEscopo,
    avisos: plano.avisos,
  };
}
