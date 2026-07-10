import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type RegistroAudit = {
  usuarioId?: string | null;
  acao: string; // criar / editar / excluir / restaurar / login / logout / ...
  tabelaAfetada: string;
  registroId?: string | null;
  dadosAnteriores?: Prisma.InputJsonValue | null;
  dadosNovos?: Prisma.InputJsonValue | null;
};

// Grava uma entrada na trilha de auditoria. Captura o IP da requisição quando
// disponível. Nunca lança erro para não derrubar a operação principal — apenas
// registra no console em caso de falha.
export async function writeAudit(registro: RegistroAudit): Promise<void> {
  try {
    let ip: string | null = null;
    try {
      const h = await headers();
      ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null;
    } catch {
      // fora de um contexto de requisição (ex.: script) — segue sem IP
    }

    await prisma.auditLog.create({
      data: {
        usuarioId: registro.usuarioId ?? null,
        acao: registro.acao,
        tabelaAfetada: registro.tabelaAfetada,
        registroId: registro.registroId ?? null,
        dadosAnteriores: registro.dadosAnteriores ?? undefined,
        dadosNovos: registro.dadosNovos ?? undefined,
        ip,
      },
    });
  } catch (erro) {
    console.error("[audit] falha ao gravar log de auditoria:", erro);
  }
}
