import "server-only";

// ─────────────────────────────────────────────────────────────────────────
// Envio via Telegram Bot API (Etapa 6 parte 2). Token do BotFather em
// TELEGRAM_BOT_TOKEN. O vínculo chatId↔membro acontece no webhook
// (src/app/api/telegram/webhook/route.ts) via deep link /start <token>.
// ─────────────────────────────────────────────────────────────────────────

const API_BASE = "https://api.telegram.org";

function obterToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN ausente no .env");
  return token;
}

export type ResultadoEnvioTelegram = { ok: true } | { ok: false; erro: string };

export async function enviarTelegram(params: {
  chatId: string;
  texto: string;
}): Promise<ResultadoEnvioTelegram> {
  try {
    const resposta = await fetch(`${API_BASE}/bot${obterToken()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: params.chatId, text: params.texto }),
    });
    const dados = await resposta.json();
    if (!dados.ok) {
      return { ok: false, erro: dados.description ?? "falha desconhecida" };
    }
    return { ok: true };
  } catch (erro) {
    return {
      ok: false,
      erro: erro instanceof Error ? erro.message : "falha desconhecida no envio",
    };
  }
}

// Nome de usuário do bot (p/ montar o deep link t.me/<username>?start=<token>).
// Cacheado em memória do processo — muda raramente, não vale a pena bater na
// API do Telegram a cada carregamento de /perfil.
let botUsernameCache: string | null = null;

export async function obterBotUsername(): Promise<string | null> {
  if (botUsernameCache) return botUsernameCache;
  try {
    const resposta = await fetch(`${API_BASE}/bot${obterToken()}/getMe`);
    const dados = await resposta.json();
    if (dados.ok && typeof dados.result?.username === "string") {
      botUsernameCache = dados.result.username as string;
      return botUsernameCache;
    }
    return null;
  } catch {
    return null;
  }
}
