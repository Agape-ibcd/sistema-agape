// Estado padrão retornado por Server Actions de escrita, consumido pelo
// popup de confirmação (FeedbackModal). `ts` garante que o efeito no cliente
// dispare mesmo quando a mesma mensagem se repete.
export type EstadoAcao = {
  ok: boolean;
  message: string;
  ts: number;
} | null;

export function sucesso(message: string): EstadoAcao {
  return { ok: true, message, ts: Date.now() };
}

export function falha(message: string): EstadoAcao {
  return { ok: false, message, ts: Date.now() };
}
