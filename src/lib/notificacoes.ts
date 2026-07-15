import "server-only";
import { prisma } from "@/lib/prisma";
import { hojeSaoPaulo, aniversariantesDoMes } from "@/lib/aniversariantes";

// Notificações do sino no cabeçalho: aniversariantes do dia + lembrete de
// escala (próximos eventos com equipe escalada). Escala é por equipe (não
// por membro) — ver EscalaEquipeEvento no schema. Líder/membro veem só a
// própria equipe; quem não tem equipeId (admin/super_admin) vê todas as
// equipes escaladas — é o caso de uso de visão geral desse nível de acesso.

const JANELA_DIAS_ESCALA = 3; // hoje + próximos N dias

export type LembreteEscala = {
  eventoId: string;
  tipoEventoNome: string;
  equipeNome: string;
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

  const inicio = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia));
  const fim = new Date(
    Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + JANELA_DIAS_ESCALA),
  );

  const escalas = await prisma.escalaEquipeEvento.findMany({
    where: {
      ...(usuario.equipeId ? { equipeId: usuario.equipeId } : {}),
      evento: {
        status: "agendado",
        dataEvento: { gte: inicio, lte: fim },
      },
    },
    select: {
      equipe: { select: { nome: true } },
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

  const lembretes: LembreteEscala[] = escalas.map(({ equipe, evento }) => {
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
      equipeNome: equipe.nome,
      dataBR: `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`,
      diasAte,
    };
  });

  return { aniversariantesHoje, escalas: lembretes };
}
