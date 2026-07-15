// Faixas de cor para indicadores percentuais do dashboard (taxa de presença,
// pontualidade). Os limites abaixo são a única fonte de configuração — ajuste
// aqui para mudar quando cada cor aparece nos cards.
export type FaixaCor = "azul" | "verde" | "laranja" | "amarelo" | "vermelho";

export type LimitesFaixa = {
  azul: number; // valor >= azul
  verde: number; // verde <= valor < azul
  laranja: number; // laranja <= valor < verde
  amarelo: number; // amarelo <= valor < laranja; abaixo disso = vermelho
};

export const LIMITES_FAIXA_PADRAO: LimitesFaixa = {
  azul: 90,
  verde: 80,
  laranja: 60,
  amarelo: 50,
};

export function faixaDaTaxa(
  valor: number,
  limites: LimitesFaixa = LIMITES_FAIXA_PADRAO,
): FaixaCor {
  if (valor >= limites.azul) return "azul";
  if (valor >= limites.verde) return "verde";
  if (valor >= limites.laranja) return "laranja";
  if (valor >= limites.amarelo) return "amarelo";
  return "vermelho";
}

export const CLASSES_FAIXA: Record<
  FaixaCor,
  { border: string; bg: string; text: string }
> = {
  azul: {
    border: "border-info-edge",
    bg: "bg-info-faint",
    text: "text-info-text",
  },
  verde: {
    border: "border-success-edge",
    bg: "bg-success-faint",
    text: "text-success-text",
  },
  laranja: {
    border: "border-orange-edge",
    bg: "bg-orange-faint",
    text: "text-orange-text",
  },
  amarelo: {
    border: "border-warn-edge",
    bg: "bg-warn-faint",
    text: "text-warn-text",
  },
  vermelho: {
    border: "border-danger-edge",
    bg: "bg-danger-faint",
    text: "text-danger-text",
  },
};
