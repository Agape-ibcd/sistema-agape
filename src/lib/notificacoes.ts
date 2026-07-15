import "server-only";
import { prisma } from "@/lib/prisma";
import { hojeSaoPaulo, aniversariantesDoMes } from "@/lib/aniversariantes";

// Notificações do sino no cabeçalho: aniversariantes do dia + lembrete de
// escala (próximos eventos em que a equipe do usuário está escalada).
// Escala é por equipe (não por membro) — ver EscalaEquipeEvento no schema —
// então o lembrete só existe para usuários com equipeId (líder/membro).

const JANELA_DIAS_ESCALA = 3; // hoje + próximos N dias

export type LembreteEscala = {
  eventoId: string;
  tipoEventoNome: string;
  dataBR: string; // dd/mm
  diasAte: number; // 0 = hoje
};

export type Notificacoes = {
  aniversariantesHoje: { id: string; nome: string }[];
  escalas: LembreteEscala[];
};

export async function carregarNotificacoes(usuario: {
  equipeId: string | null;
}): Promise<Notificacoes> {
  const hoje = hojeSaoPaulo();

  const aniversariantes = await aniversariantesDoMes(hoje);
  const aniversariantesHoje = aniversariantes
    .filter((a) => a.ehHoje)
    .map((a) => ({ id: a.id, nome: a.nome }));

  if (!usuario.equipeId) {
    return { aniversariantesHoje, escalas: [] };
  }

  const inicio = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia));
  const fim = new Date(
    Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + JANELA_DIAS_ESCALA),
  );

  const escalas = await prisma.escalaEquipeEvento.findMany({
    where: {
      equipeId: usuario.equipeId,
      evento: {
        status: "agendado",
        dataEvento: { gte: inicio, lte: fim },
      },
    },
    select: {
      evento: {
        select: {
          id: true,
          dataEvento: true,
          tipoEvento: { select: { nome: true } },
        },
      },
    },
    orderBy: { evento: { dataEvento: "asc" } },
  });

  const lembretes: LembreteEscala[] = escalas.map(({ evento }) => {
    const dia = evento.dataEvento.getUTCDate();
    const mes = evento.dataEvento.getUTCMonth() + 1;
    const diasAte = Math.round(
      (Date.UTC(
        evento.dataEvento.getUTCFullYear(),
        evento.dataEvento.getUTCMonth(),
        evento.dataEvento.getUTCDate(),
      ) -
        Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia)) /
        86_400_000,
    );
    return {
      eventoId: evento.id,
      tipoEventoNome: evento.tipoEvento.nome,
      dataBR: `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`,
      diasAte,
    };
  });

  return { aniversariantesHoje, escalas: lembretes };
}
