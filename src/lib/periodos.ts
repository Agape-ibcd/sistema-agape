// Períodos pré-configurados do dashboard. Módulo PURO (sem server-only): é
// usado tanto no padrão do servidor (resolverFiltros) quanto nos botões do
// cliente (FiltrosDashboard). Datas em UTC meia-noite, como no resto do app.

const DIA_MS = 86_400_000;

export type PeriodoId =
  | "semana_atual"
  | "semana_anterior"
  | "mes_atual"
  | "mes_anterior"
  | "trimestre"
  | "semestre"
  | "ano";

export const PERIODOS: { id: PeriodoId; rotulo: string }[] = [
  { id: "semana_atual", rotulo: "Semana atual" },
  { id: "semana_anterior", rotulo: "Semana anterior" },
  { id: "mes_atual", rotulo: "Mês atual" },
  { id: "mes_anterior", rotulo: "Mês anterior" },
  { id: "trimestre", rotulo: "Último trimestre" },
  { id: "semestre", rotulo: "Último semestre" },
  { id: "ano", rotulo: "Este ano" },
];

// Padrão do dashboard quando não há período na URL.
export const PERIODO_PADRAO: PeriodoId = "semana_atual";

// Hoje como UTC meia-noite, derivado da data local (mesmo padrão do app).
export function hojeUTC(): Date {
  const a = new Date();
  return new Date(Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()));
}

// Domingo (início) da semana civil que contém a data.
function inicioSemana(d: Date): Date {
  return new Date(d.getTime() - d.getUTCDay() * DIA_MS);
}

// Intervalo [inicio, fim] (ambos inclusivos, UTC meia-noite) de um período.
// `base` permite testar/derivar a partir de outra data que não hoje.
export function intervaloPeriodo(
  id: PeriodoId,
  base: Date = hojeUTC(),
): { inicio: Date; fim: Date } {
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const d = base.getUTCDate();

  switch (id) {
    case "semana_atual": {
      const inicio = inicioSemana(base);
      return { inicio, fim: new Date(inicio.getTime() + 6 * DIA_MS) };
    }
    case "semana_anterior": {
      const inicio = new Date(inicioSemana(base).getTime() - 7 * DIA_MS);
      return { inicio, fim: new Date(inicio.getTime() + 6 * DIA_MS) };
    }
    case "mes_atual":
      return {
        inicio: new Date(Date.UTC(y, m, 1)),
        fim: new Date(Date.UTC(y, m + 1, 0)),
      };
    case "mes_anterior":
      return {
        inicio: new Date(Date.UTC(y, m - 1, 1)),
        fim: new Date(Date.UTC(y, m, 0)),
      };
    // Trimestre/semestre: janela móvel terminando hoje.
    case "trimestre":
      return { inicio: new Date(Date.UTC(y, m - 3, d)), fim: base };
    case "semestre":
      return { inicio: new Date(Date.UTC(y, m - 6, d)), fim: base };
    case "ano":
      return { inicio: new Date(Date.UTC(y, 0, 1)), fim: base };
  }
}
