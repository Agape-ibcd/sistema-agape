import type { TipoRecorrencia } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────
// Motor de recorrência — funções puras, sem banco.
// Datas sempre em UTC meia-noite (mesma convenção do scripts/migrate.ts):
// new Date(Date.UTC(ano, mes-1, dia)). Dia da semana: 0=domingo … 6=sábado.
//
// Formato do config_recorrencia (JSONB) por modo:
//   diario                → {}                          (todos os dias)
//   semanal               → { diasSemana: number[] }    (ex.: [0] = domingos)
//   quinzenal             → { dataBase: "YYYY-MM-DD" }  (1ª ocorrência; a cada 14 dias)
//   mensal_dia_fixo       → { dia: 1..31 }              (meses curtos: usa o último dia)
//   mensal_posicao        → { posicao: 1..4, diaSemana: 0..6 }  (ex.: 1ª terça)
//   mensal_ultima_posicao → { diaSemana: 0..6 }         (ex.: último domingo)
//   avulso                → {}                          (não gera instâncias)
// ─────────────────────────────────────────────────────────────────────────

export type ConfigRecorrencia = {
  diasSemana?: number[];
  dataBase?: string;
  dia?: number;
  posicao?: number;
  diaSemana?: number;
};

export const DIAS_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

export const DIAS_SEMANA_CURTO = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
] as const;

export const ROTULO_RECORRENCIA: Record<TipoRecorrencia, string> = {
  diario: "Diário",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal_dia_fixo: "Mensal (dia fixo)",
  mensal_posicao: "Mensal (posição)",
  mensal_ultima_posicao: "Mensal (última posição)",
  avulso: "Avulso",
};

const ORDINAL = ["", "1ª", "2ª", "3ª", "4ª"];

export function dataUTC(ano: number, mes1a12: number, dia: number): Date {
  return new Date(Date.UTC(ano, mes1a12 - 1, dia));
}

export function parseDataISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = dataUTC(Number(m[1]), Number(m[2]), Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatarDataISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDias(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

function ultimoDiaDoMes(ano: number, mes1a12: number): number {
  return new Date(Date.UTC(ano, mes1a12, 0)).getUTCDate();
}

// N-ésimo <diaSemana> do mês (posicao 1..4); null se o mês não tiver a posição.
function diaPorPosicao(
  ano: number,
  mes1a12: number,
  posicao: number,
  diaSemana: number,
): Date | null {
  const primeiro = dataUTC(ano, mes1a12, 1);
  const offset = (diaSemana - primeiro.getUTCDay() + 7) % 7;
  const dia = 1 + offset + (posicao - 1) * 7;
  if (dia > ultimoDiaDoMes(ano, mes1a12)) return null;
  return dataUTC(ano, mes1a12, dia);
}

// Último <diaSemana> do mês.
function ultimoPorDiaSemana(
  ano: number,
  mes1a12: number,
  diaSemana: number,
): Date {
  const ultimo = dataUTC(ano, mes1a12, ultimoDiaDoMes(ano, mes1a12));
  const offset = (ultimo.getUTCDay() - diaSemana + 7) % 7;
  return addDias(ultimo, -offset);
}

// Valida o config para o modo. Retorna mensagem de erro ou null se ok.
export function validarConfig(
  tipo: TipoRecorrencia,
  config: ConfigRecorrencia,
): string | null {
  const diaSemanaOk = (v: unknown) =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 6;

  switch (tipo) {
    case "diario":
    case "avulso":
      return null;
    case "semanal":
      if (
        !Array.isArray(config.diasSemana) ||
        config.diasSemana.length === 0 ||
        !config.diasSemana.every(diaSemanaOk)
      ) {
        return "Selecione ao menos um dia da semana.";
      }
      return null;
    case "quinzenal":
      if (!config.dataBase || !parseDataISO(config.dataBase)) {
        return "Informe a data da primeira ocorrência.";
      }
      return null;
    case "mensal_dia_fixo":
      if (
        typeof config.dia !== "number" ||
        !Number.isInteger(config.dia) ||
        config.dia < 1 ||
        config.dia > 31
      ) {
        return "Informe um dia do mês entre 1 e 31.";
      }
      return null;
    case "mensal_posicao":
      if (
        typeof config.posicao !== "number" ||
        config.posicao < 1 ||
        config.posicao > 4
      ) {
        return "Informe a posição no mês (1ª a 4ª).";
      }
      if (!diaSemanaOk(config.diaSemana)) {
        return "Selecione o dia da semana.";
      }
      return null;
    case "mensal_ultima_posicao":
      if (!diaSemanaOk(config.diaSemana)) {
        return "Selecione o dia da semana.";
      }
      return null;
  }
}

// Gera as datas de ocorrência no intervalo [inicio, fim] (inclusive, UTC).
// `avulso` nunca gera. Config inválido gera lista vazia (valide antes com
// validarConfig para mostrar erro ao usuário).
export function gerarDatas(
  tipo: TipoRecorrencia,
  config: ConfigRecorrencia,
  inicio: Date,
  fim: Date,
): Date[] {
  if (validarConfig(tipo, config) !== null) return [];
  if (inicio.getTime() > fim.getTime()) return [];

  const datas: Date[] = [];

  switch (tipo) {
    case "avulso":
      break;

    case "diario":
      for (let d = inicio; d.getTime() <= fim.getTime(); d = addDias(d, 1)) {
        datas.push(d);
      }
      break;

    case "semanal": {
      const dias = new Set(config.diasSemana);
      for (let d = inicio; d.getTime() <= fim.getTime(); d = addDias(d, 1)) {
        if (dias.has(d.getUTCDay())) datas.push(d);
      }
      break;
    }

    case "quinzenal": {
      const base = parseDataISO(config.dataBase!)!;
      // Primeira ocorrência dentro (ou depois) do início da janela.
      let d = base;
      if (d.getTime() < inicio.getTime()) {
        const ciclos = Math.ceil((inicio.getTime() - d.getTime()) / (14 * 86_400_000));
        d = addDias(d, ciclos * 14);
      }
      for (; d.getTime() <= fim.getTime(); d = addDias(d, 14)) {
        datas.push(d);
      }
      break;
    }

    case "mensal_dia_fixo":
    case "mensal_posicao":
    case "mensal_ultima_posicao": {
      // Percorre os meses tocados pela janela e calcula a ocorrência de cada um.
      let ano = inicio.getUTCFullYear();
      let mes = inicio.getUTCMonth() + 1;
      const fimAno = fim.getUTCFullYear();
      const fimMes = fim.getUTCMonth() + 1;
      while (ano < fimAno || (ano === fimAno && mes <= fimMes)) {
        let d: Date | null = null;
        if (tipo === "mensal_dia_fixo") {
          d = dataUTC(ano, mes, Math.min(config.dia!, ultimoDiaDoMes(ano, mes)));
        } else if (tipo === "mensal_posicao") {
          d = diaPorPosicao(ano, mes, config.posicao!, config.diaSemana!);
        } else {
          d = ultimoPorDiaSemana(ano, mes, config.diaSemana!);
        }
        if (d && d.getTime() >= inicio.getTime() && d.getTime() <= fim.getTime()) {
          datas.push(d);
        }
        mes += 1;
        if (mes > 12) {
          mes = 1;
          ano += 1;
        }
      }
      break;
    }
  }

  return datas;
}

// horario_chegada_equipe = horario_inicio − 01:15 (regra do PDF).
// Eventos de madrugada (< 01:15) fazem o horário "dar a volta" para a véspera.
export function calcularHorarioChegada(horarioInicio: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(horarioInicio.trim());
  if (!m) return horarioInicio;
  const total = (((Number(m[1]) * 60 + Number(m[2])) - 75) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const min = total % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function horarioValido(horario: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(horario.trim());
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

// Descrição legível da recorrência para listas e no calendário.
export function descreverRecorrencia(
  tipo: TipoRecorrencia,
  config: ConfigRecorrencia,
): string {
  switch (tipo) {
    case "diario":
      return "Todos os dias";
    case "semanal": {
      const dias = (config.diasSemana ?? [])
        .slice()
        .sort()
        .map((d) => DIAS_SEMANA_CURTO[d] ?? "?");
      return dias.length ? `Semanal · ${dias.join(", ")}` : "Semanal";
    }
    case "quinzenal": {
      const base = config.dataBase ? parseDataISO(config.dataBase) : null;
      return base
        ? `Quinzenal · ${DIAS_SEMANA_CURTO[base.getUTCDay()]} (desde ${base.toLocaleDateString("pt-BR", { timeZone: "UTC" })})`
        : "Quinzenal";
    }
    case "mensal_dia_fixo":
      return config.dia ? `Todo dia ${config.dia} do mês` : "Mensal (dia fixo)";
    case "mensal_posicao":
      return config.posicao != null && config.diaSemana != null
        ? `${ORDINAL[config.posicao] ?? config.posicao + "ª"} ${DIAS_SEMANA[config.diaSemana]?.toLowerCase() ?? "?"} do mês`
        : "Mensal (posição)";
    case "mensal_ultima_posicao":
      return config.diaSemana != null
        ? `Último(a) ${DIAS_SEMANA[config.diaSemana]?.toLowerCase() ?? "?"} do mês`
        : "Mensal (última posição)";
    case "avulso":
      return "Avulso (sem recorrência)";
  }
}
