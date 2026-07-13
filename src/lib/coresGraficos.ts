// Cores dos gráficos Recharts por tema. O Recharts recebe cor como string
// (atributo SVG), então os tokens CSS de globals.css não chegam até ele —
// esta é a segunda (e última) parada ao trocar a paleta do app.
export type Tema = "claro" | "escuro";

export type CoresGraficos = {
  presenca: string; // barras de presença (marca)
  pontual: string;
  atraso: string;
  ausencia: string;
  linha: string;
  grade: string; // CartesianGrid
  eixo: string; // ticks dos eixos
  tooltipFundo: string;
  tooltipBorda: string;
  tooltipTexto: string;
};

const CLARO: CoresGraficos = {
  presenca: "#059669", // emerald-600
  pontual: "#10b981", // emerald-500
  atraso: "#f59e0b", // amber-500
  ausencia: "#f43f5e", // rose-500
  linha: "#0ea5e9", // sky-500
  grade: "#f4f4f5", // zinc-100
  eixo: "#71717a", // zinc-500
  tooltipFundo: "#ffffff",
  tooltipBorda: "#e4e4e7", // zinc-200
  tooltipTexto: "#18181b", // zinc-900
};

const ESCURO: CoresGraficos = {
  presenca: "#10b981", // emerald-500 (mais viva sobre fundo escuro)
  pontual: "#34d399", // emerald-400
  atraso: "#fbbf24", // amber-400
  ausencia: "#fb7185", // rose-400
  linha: "#38bdf8", // sky-400
  grade: "#27272a", // zinc-800
  eixo: "#a1a1aa", // zinc-400
  tooltipFundo: "#18181b", // zinc-900
  tooltipBorda: "#3f3f46", // zinc-700
  tooltipTexto: "#f4f4f5", // zinc-100
};

export function coresGraficos(tema: Tema): CoresGraficos {
  return tema === "escuro" ? ESCURO : CLARO;
}
