import type { TipoEscala } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────
// Motor do rodízio de escalas — funções puras, sem banco (testáveis em
// scripts/test-rodizio.ts). Datas em UTC meia-noite, mesma convenção de
// src/lib/recorrencia.ts.
//
// Regra combinada com o usuário (2026-07-11):
//  • O ciclo é uma lista de semanas; cada entrada diz qual equipe cobre a
//    manhã e qual cobre a noite naquela semana. Quinzenal = ciclo de 2.
//  • A semana vai de domingo a sábado. O índice no ciclo é o nº de semanas
//    desde a semana âncora, mod tamanho do ciclo (funciona também para datas
//    anteriores à âncora).
//  • DOMINGO: só a equipe do turno do culto — manhã se o início for antes de
//    16:00, noite caso contrário (tipo `regular`).
//  • DEMAIS DIAS (inclusive eventos avulsos/extras): as DUAS equipes da
//    semana apoiam (tipo `cobertura`).
//  • Evento com QUALQUER escala manual é considerado personalizado (ex.:
//    conferência com equipes próprias) e o rodízio não mexe nele.
//  • O rodízio só cria/remove escalas de origem `rodizio` — e nunca remove
//    uma escala que já tenha presença lançada (vira aviso).
// ─────────────────────────────────────────────────────────────────────────

const DIA_MS = 86_400_000;
const SEMANA_MS = 7 * DIA_MS;

// Início do culto a partir desta hora = turno da noite (domingo).
export const CORTE_TURNO_NOITE_H = 16;

export type EntradaCiclo = {
  manha: string; // equipeId
  noite: string; // equipeId
};

export type ConfigRodizio = {
  semanaAncora: Date; // domingo (UTC) que inicia o ciclo
  ciclo: EntradaCiclo[];
};

// Domingo (UTC meia-noite) da semana que contém a data.
export function domingoDaSemana(d: Date): Date {
  return new Date(d.getTime() - d.getUTCDay() * DIA_MS);
}

// Índice da entrada do ciclo para a semana que contém `data`. Datas anteriores
// à âncora também funcionam (módulo sempre não-negativo).
export function indiceCiclo(
  data: Date,
  semanaAncora: Date,
  tamanhoCiclo: number,
): number {
  if (tamanhoCiclo <= 0) return 0;
  const diff =
    domingoDaSemana(data).getTime() - domingoDaSemana(semanaAncora).getTime();
  const semanas = Math.round(diff / SEMANA_MS);
  return ((semanas % tamanhoCiclo) + tamanhoCiclo) % tamanhoCiclo;
}

function horaInicio(horario: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(horario.trim());
  return m ? Number(m[1]) : 0;
}

// Equipes que o rodízio quer neste evento, segundo a entrada do ciclo da semana.
export function equipesDesejadas(
  evento: { dataEvento: Date; horarioInicio: string },
  entrada: EntradaCiclo,
): { equipeId: string; tipoEscala: TipoEscala }[] {
  if (evento.dataEvento.getUTCDay() === 0) {
    const noite = horaInicio(evento.horarioInicio) >= CORTE_TURNO_NOITE_H;
    return [{ equipeId: noite ? entrada.noite : entrada.manha, tipoEscala: "regular" }];
  }
  // Meio de semana (e avulsos): as duas equipes apoiam. Dedup caso a mesma
  // equipe cubra os dois turnos na semana.
  const ids = [...new Set([entrada.manha, entrada.noite])];
  return ids.map((equipeId) => ({ equipeId, tipoEscala: "cobertura" as TipoEscala }));
}

// ── Planejamento da aplicação (puro) ─────────────────────────────────────

export type EventoParaRodizio = {
  id: string;
  rotulo: string; // para o relatório/avisos
  dataEvento: Date;
  horarioInicio: string;
  status: "agendado" | "realizado" | "cancelado";
  escalas: {
    id: string;
    equipeId: string;
    origem: "manual" | "rodizio";
    temPresenca: boolean; // presenças ativas de (evento, equipe)
  }[];
};

export type PlanoRodizio = {
  criar: { eventoId: string; equipeId: string; tipoEscala: TipoEscala }[];
  removerEscalaIds: string[];
  eventosAlterados: number; // eventos com criação e/ou remoção
  eventosJaCorretos: number; // agendados, sem manual, nada a fazer
  eventosPersonalizados: number; // pulados por terem escala manual
  eventosForaDeEscopo: number; // cancelados/realizados
  avisos: string[];
};

export function planejarRodizio(
  config: ConfigRodizio,
  eventos: EventoParaRodizio[],
): PlanoRodizio {
  const plano: PlanoRodizio = {
    criar: [],
    removerEscalaIds: [],
    eventosAlterados: 0,
    eventosJaCorretos: 0,
    eventosPersonalizados: 0,
    eventosForaDeEscopo: 0,
    avisos: [],
  };
  if (config.ciclo.length === 0) return plano;

  for (const evento of eventos) {
    if (evento.status !== "agendado") {
      plano.eventosForaDeEscopo += 1;
      continue;
    }
    if (evento.escalas.some((e) => e.origem === "manual")) {
      plano.eventosPersonalizados += 1;
      continue;
    }

    const entrada =
      config.ciclo[indiceCiclo(evento.dataEvento, config.semanaAncora, config.ciclo.length)];
    const desejadas = equipesDesejadas(evento, entrada);
    const desejadasIds = new Set(desejadas.map((d) => d.equipeId));
    const existentesIds = new Set(evento.escalas.map((e) => e.equipeId));

    let mudou = false;

    for (const d of desejadas) {
      if (!existentesIds.has(d.equipeId)) {
        plano.criar.push({ eventoId: evento.id, ...d });
        mudou = true;
      }
    }

    // Escalas de rodízio que não pertencem mais à semana (ex.: ciclo editado).
    for (const e of evento.escalas) {
      if (e.origem !== "rodizio" || desejadasIds.has(e.equipeId)) continue;
      if (e.temPresenca) {
        plano.avisos.push(
          `${evento.rotulo}: escala antiga do rodízio mantida — já há presença lançada para a equipe.`,
        );
        continue;
      }
      plano.removerEscalaIds.push(e.id);
      mudou = true;
    }

    if (mudou) plano.eventosAlterados += 1;
    else plano.eventosJaCorretos += 1;
  }

  return plano;
}

// ── Validação da configuração (usada pela action e pela tela) ────────────

export function validarCicloRodizio(
  ciclo: EntradaCiclo[],
  equipesValidas: Set<string>,
): string | null {
  if (ciclo.length === 0) {
    return "Adicione ao menos uma semana ao ciclo do rodízio.";
  }
  for (const [i, entrada] of ciclo.entries()) {
    if (!entrada.manha || !equipesValidas.has(entrada.manha)) {
      return `Semana ${i + 1} do ciclo: selecione a equipe da manhã.`;
    }
    if (!entrada.noite || !equipesValidas.has(entrada.noite)) {
      return `Semana ${i + 1} do ciclo: selecione a equipe da noite.`;
    }
  }
  return null;
}

// Prévia legível: entrada do ciclo de cada uma das próximas N semanas.
export function previaSemanas(
  config: ConfigRodizio,
  aPartirDe: Date,
  quantidade: number,
): { domingo: Date; indice: number; entrada: EntradaCiclo }[] {
  const inicio = domingoDaSemana(aPartirDe);
  return Array.from({ length: quantidade }, (_, i) => {
    const domingo = new Date(inicio.getTime() + i * SEMANA_MS);
    const indice = indiceCiclo(domingo, config.semanaAncora, config.ciclo.length);
    return { domingo, indice, entrada: config.ciclo[indice] };
  });
}
