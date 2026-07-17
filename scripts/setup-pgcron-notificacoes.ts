import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────
// Etapa 6 (rodada 2) — liga a checagem de gatilhos diários dentro do próprio
// Supabase: extensões pg_cron + pg_net, e um job que bate na rota
// /api/cron/notificacoes-diarias a cada 10 minutos. A rota decide se É a
// hora certa de cada regra (ver src/lib/notificacoesEnvio.ts) — chamar fora
// de hora não manda nada, então rodar a cada 10 min é seguro e barato.
//
// Isso contorna o limite do Vercel Cron no plano Hobby (só 1 execução fixa
// por dia), permitindo que o horário configurado no painel /configuracoes
// realmente valha. Idempotente: pode rodar de novo (reagenda o job).
//
// Precisa de DIRECT_URL (conexão de sessão, porta 5432) — o pooler de
// transação (6543) não é confiável para esse tipo de comando neste ambiente.
// ─────────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

const NOME_JOB = "notificacoes-diarias";

async function main() {
  const appUrl = process.env.APP_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!appUrl || !cronSecret) {
    throw new Error("APP_URL e/ou CRON_SECRET ausentes no .env");
  }
  const urlRota = `${appUrl.replace(/\/$/, "")}/api/cron/notificacoes-diarias`;

  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_cron;`);
  console.log("Extensão pg_cron ok.");

  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_net;`);
  console.log("Extensão pg_net ok.");

  // Remove o job anterior se existir (idempotência) — ignora erro se não existia.
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      PERFORM cron.unschedule('${NOME_JOB}');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END $$;
  `);

  const comando = `
    SELECT net.http_get(
      url := '${urlRota}',
      headers := jsonb_build_object('Authorization', 'Bearer ${cronSecret}')
    );
  `.replace(/'/g, "''");

  await prisma.$executeRawUnsafe(
    `SELECT cron.schedule('${NOME_JOB}', '*/10 * * * *', '${comando}');`,
  );
  console.log(`Job "${NOME_JOB}" agendado: a cada 10 minutos → ${urlRota}`);

  console.log(
    "\nPara conferir se está rodando (depois de alguns minutos):\n" +
      "  SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;\n" +
      "(rode no SQL Editor do Supabase)",
  );
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
