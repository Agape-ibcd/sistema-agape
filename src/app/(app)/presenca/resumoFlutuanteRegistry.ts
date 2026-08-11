"use client";

// Registro compartilhado (mesmo padrão de pendenciaGuard.ts) para o
// ResumoFlutuante somar escalados/presentes/ausentes de TODAS as seções de
// ListaPresenca visíveis na tela (ex.: admin vendo mais de uma equipe no
// mesmo evento) — sem precisar levantar estado para um Context.
export type ContagemSecao = { escalados: number; presentes: number; ausentes: number };

const secoes = new Map<string, () => ContagemSecao>();

export function registrarContagemSecao(id: string, contar: () => ContagemSecao): () => void {
  secoes.set(id, contar);
  return () => {
    secoes.delete(id);
  };
}

export function contarTudoPresenca(): ContagemSecao {
  let escalados = 0;
  let presentes = 0;
  let ausentes = 0;
  for (const contar of secoes.values()) {
    const r = contar();
    escalados += r.escalados;
    presentes += r.presentes;
    ausentes += r.ausentes;
  }
  return { escalados, presentes, ausentes };
}
