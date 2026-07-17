import { NextRequest, NextResponse } from "next/server";
import { enviarNotificacoesAniversarioHoje } from "@/lib/notificacoesEnvio";

// Disparado 1x/dia pelo Vercel Cron (vercel.json). Autenticado pelo header
// que a própria Vercel envia em execuções de cron (Authorization: Bearer
// <CRON_SECRET>) — impede qualquer terceiro de acionar envios em massa
// batendo nesta URL.
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!segredo || auth !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const aniversario = await enviarNotificacoesAniversarioHoje();

  return NextResponse.json({ aniversario });
}
