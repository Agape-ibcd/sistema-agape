import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarTelegram } from "@/lib/telegram";

// Webhook do Telegram (Etapa 6 parte 2). Autenticado pelo header
// `X-Telegram-Bot-Api-Secret-Token` (configurado no setWebhook — ver
// scripts/setup-telegram-webhook.ts), não por sessão de usuário: precisa
// estar em ROTAS_PUBLICAS (src/lib/supabase/middleware.ts), senão o
// middleware redireciona para /login antes de chegar aqui.
// Único comando tratado: /start <token> — vincula o telegramChatId ao
// membro dono do token gerado em /perfil (expira sozinho).
export async function POST(request: NextRequest) {
  const segredo = process.env.TELEGRAM_WEBHOOK_SECRET;
  const recebido = request.headers.get("x-telegram-bot-api-secret-token");
  if (!segredo || recebido !== segredo) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const update = await request.json().catch(() => null);
  const mensagem = update?.message;
  const texto: string | undefined = mensagem?.text;
  const chatId: string | undefined = mensagem?.chat?.id?.toString();

  if (texto && chatId && texto.startsWith("/start")) {
    const token = texto.replace("/start", "").trim();

    if (!token) {
      await enviarTelegram({
        chatId,
        texto:
          "Olá! Para vincular sua conta, gere o link em Meu Perfil no Sistema Ágape e clique nele (não use /start direto aqui).",
      });
      return NextResponse.json({ ok: true });
    }

    const membro = await prisma.membro.findFirst({
      where: { telegramLinkToken: token, telegramLinkExpira: { gt: new Date() } },
    });

    if (!membro) {
      await enviarTelegram({
        chatId,
        texto: "Link de vínculo inválido ou expirado. Gere um novo em Meu Perfil no Sistema Ágape.",
      });
      return NextResponse.json({ ok: true });
    }

    await prisma.membro.update({
      where: { id: membro.id },
      data: {
        telegramChatId: chatId,
        notifTelegram: true,
        telegramLinkToken: null,
        telegramLinkExpira: null,
      },
    });

    await enviarTelegram({
      chatId,
      texto: `Olá, ${membro.nomeCompleto.split(" ")[0]}! Seu Telegram foi vinculado ao Sistema Ágape. A partir de agora você recebe avisos de escala e aniversário por aqui também.`,
    });
  }

  return NextResponse.json({ ok: true });
}
