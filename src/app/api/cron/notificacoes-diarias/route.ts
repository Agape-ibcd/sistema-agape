import { NextRequest, NextResponse } from "next/server";
import { verificarEDispararGatilhosDiarios } from "@/lib/notificacoesEnvio";

// Chamada com frequência (pg_cron do Supabase, a cada poucos minutos — ver
// scripts/setup-pgcron-notificacoes.ts) e também 1x/dia pelo Vercel Cron
// (vercel.json) como rede de segurança. Quem decide se É a hora de disparar
// cada gatilho é `verificarEDispararGatilhosDiarios` (compara com o
// `horarioEnvio` configurado no painel /configuracoes e evita duplicar no
// mesmo dia) — chamar esta rota fora de hora não manda nada.
// Autenticado por header (Authorization: Bearer <CRON_SECRET>) — impede
// qualquer terceiro de acionar a checagem batendo nesta URL.
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!segredo || auth !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const status = await verificarEDispararGatilhosDiarios();

  return NextResponse.json({ status });
}
