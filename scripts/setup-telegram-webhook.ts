import "dotenv/config";

// ─────────────────────────────────────────────────────────────────────────
// Etapa 6 (parte 2) — registra o webhook do bot do Telegram apontando para
// /api/telegram/webhook, protegido por secret_token (checado no header
// X-Telegram-Bot-Api-Secret-Token pela própria rota). Idempotente: pode
// rodar de novo (o Telegram substitui o webhook anterior).
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const appUrl = process.env.APP_URL;
  if (!token || !secret || !appUrl) {
    throw new Error("TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET e/ou APP_URL ausentes no .env");
  }

  const urlWebhook = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`;

  const resposta = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: urlWebhook,
      secret_token: secret,
      drop_pending_updates: true,
    }),
  });
  const dados = await resposta.json();
  if (!dados.ok) {
    throw new Error(`Telegram recusou o setWebhook: ${dados.description ?? "erro desconhecido"}`);
  }
  console.log(`Webhook registrado: ${urlWebhook}`);

  const info = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json());
  if (info.ok) {
    console.log(
      `Bot: @${info.result.username} — deep link de vínculo: https://t.me/${info.result.username}?start=<token>`,
    );
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
