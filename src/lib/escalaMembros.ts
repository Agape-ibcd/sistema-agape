// ─────────────────────────────────────────────────────────────────────────
// Convocação por membro (escala parcial).
//
// Uma EscalaEquipeEvento sem linhas em EscalaMembro convoca a EQUIPE INTEIRA
// (comportamento original — é o que o rodízio sempre cria). Quando há linhas,
// só ESSES membros são convocados: presença, notificações e lembrete da
// véspera passam a olhar o subconjunto. Este módulo é puro (sem I/O) para
// poder ser usado tanto no servidor quanto derivado no cliente.
// ─────────────────────────────────────────────────────────────────────────

// Dado o conjunto de membros ativos de uma equipe e as linhas de convocação
// da escala, devolve quem está de fato convocado. Lista de convocação vazia
// ⇒ equipe inteira.
export function membrosConvocados<T extends { id: string }>(
  todosDaEquipe: T[],
  convocacao: { membroId: string }[],
): T[] {
  if (convocacao.length === 0) return todosDaEquipe;
  const ids = new Set(convocacao.map((c) => c.membroId));
  return todosDaEquipe.filter((m) => ids.has(m.id));
}

// True quando a escala convoca só parte da equipe (tem linhas de convocação).
export function escalaEhParcial(convocacao: { membroId: string }[]): boolean {
  return convocacao.length > 0;
}
