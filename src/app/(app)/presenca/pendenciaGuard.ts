"use client";

// Registro compartilhado (módulo, não Context — mais simples para um caso de
// uso único nesta página) de quantas seções de ListaPresenca estão montadas
// na tela e se cada uma tem membro sem presença/ausência lançada. Usado pelo
// AvisoSairPendencia para decidir se avisa antes de sair de /presenca com
// pendência (fechar aba, recarregar, ou navegar para outro link interno).
const checagens = new Map<string, () => boolean>();

// `id` deve ser único por seção (ex.: `${eventoId}:${equipeId}`) — cada
// ListaPresenca chama isto no mount e usa o retorno para desregistrar no
// unmount (troca de evento/semana desmonta a seção anterior).
export function registrarChecagemPendencia(id: string, temPendencia: () => boolean): () => void {
  checagens.set(id, temPendencia);
  return () => {
    checagens.delete(id);
  };
}

// Chamado SOB DEMANDA (clique em link, beforeunload) — nunca reativo, para
// não forçar re-render da página a cada tecla digitada em outra seção.
export function haPendenciaNaPagina(): boolean {
  for (const checar of checagens.values()) {
    if (checar()) return true;
  }
  return false;
}
