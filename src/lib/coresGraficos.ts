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

// Paleta Ágape: presença/pontual = verde (positivo), atraso = dourado,
// ausência = vermelho Ágape, linha de evolução = navy (primário).
const CLARO: CoresGraficos = {
  presenca: "#2e7d52", // verde sucesso
  pontual: "#3fa06a", // verde mais claro
  atraso: "#b8860b", // dourado
  ausencia: "#e1352a", // vermelho Ágape
  linha: "#0d2b5c", // navy institucional
  grade: "#e3e1dc", // gray-200 (papel)
  eixo: "#6b6b6b",
  tooltipFundo: "#ffffff",
  tooltipBorda: "#e3e1dc",
  tooltipTexto: "#1a1a1a",
};

const ESCURO: CoresGraficos = {
  presenca: "#3fa06a", // verde vivo sobre grafite
  pontual: "#6fce9c",
  atraso: "#d6a93a", // dourado claro
  ausencia: "#ef5a50", // vermelho Ágape claro
  linha: "#6f97d6", // navy claro
  grade: "#262a33",
  eixo: "#9a988f",
  tooltipFundo: "#191b21",
  tooltipBorda: "#3a3f49",
  tooltipTexto: "#f3f1ec",
};

export function coresGraficos(tema: Tema): CoresGraficos {
  return tema === "escuro" ? ESCURO : CLARO;
}
