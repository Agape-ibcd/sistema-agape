import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Consulta paginada do AuditLog para a tela /auditoria (só super_admin).
// `usuarioId` no AuditLog é o `membroId` de quem agiu (sem FK — ver audit.ts),
// então o nome é resolvido aqui com uma segunda consulta em vez de `include`.

export const TAMANHO_PAGINA = 30;

// AuditLog.timestamp é DateTime (não Date puro como eventos) — os limites de
// dia são calculados no fuso de São Paulo (UTC-3 fixo, sem DST no Brasil desde
// 2019, mesma premissa já usada nos crons do projeto).
export function inicioDoDiaSP(iso: string): Date | null {
  const d = new Date(`${iso}T00:00:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
export function fimDoDiaSP(iso: string): Date | null {
  const d = new Date(`${iso}T23:59:59.999-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type FiltrosAuditoria = {
  acao?: string;
  tabela?: string;
  usuarioId?: string;
  de?: Date;
  ate?: Date; // já ajustado para o fim do dia por quem chama
  pagina: number;
};

export type RegistroAuditoria = {
  id: string;
  acao: string;
  tabelaAfetada: string;
  registroId: string | null;
  dadosAnteriores: Prisma.JsonValue | null;
  dadosNovos: Prisma.JsonValue | null;
  ip: string | null;
  timestamp: Date;
  usuarioNome: string | null;
};

export async function listarAuditoria(filtros: FiltrosAuditoria): Promise<{
  registros: RegistroAuditoria[];
  total: number;
  totalPaginas: number;
}> {
  const where: Prisma.AuditLogWhereInput = {
    ...(filtros.acao ? { acao: filtros.acao } : {}),
    ...(filtros.tabela ? { tabelaAfetada: filtros.tabela } : {}),
    ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
    ...(filtros.de || filtros.ate
      ? {
          timestamp: {
            ...(filtros.de ? { gte: filtros.de } : {}),
            ...(filtros.ate ? { lte: filtros.ate } : {}),
          },
        }
      : {}),
  };

  const pagina = Math.max(1, filtros.pagina);

  const [total, brutos] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (pagina - 1) * TAMANHO_PAGINA,
      take: TAMANHO_PAGINA,
    }),
  ]);

  const idsUsuarios = [...new Set(brutos.map((r) => r.usuarioId).filter((v): v is string => !!v))];
  const membros = idsUsuarios.length
    ? await prisma.membro.findMany({
        where: { id: { in: idsUsuarios } },
        select: { id: true, nomeCompleto: true },
      })
    : [];
  const nomePorId = new Map(membros.map((m) => [m.id, m.nomeCompleto]));

  const registros: RegistroAuditoria[] = brutos.map((r) => ({
    id: r.id,
    acao: r.acao,
    tabelaAfetada: r.tabelaAfetada,
    registroId: r.registroId,
    dadosAnteriores: r.dadosAnteriores,
    dadosNovos: r.dadosNovos,
    ip: r.ip,
    timestamp: r.timestamp,
    usuarioNome: r.usuarioId ? (nomePorId.get(r.usuarioId) ?? "Membro removido") : null,
  }));

  return { registros, total, totalPaginas: Math.max(1, Math.ceil(total / TAMANHO_PAGINA)) };
}

// Opções para os filtros — valores distintos já usados no log, não uma lista
// hardcoded (evita desatualizar quando uma ação/tabela nova for introduzida).
export async function opcoesFiltroAuditoria(): Promise<{
  acoes: string[];
  tabelas: string[];
}> {
  const [acoes, tabelas] = await Promise.all([
    prisma.auditLog.findMany({ distinct: ["acao"], select: { acao: true }, orderBy: { acao: "asc" } }),
    prisma.auditLog.findMany({
      distinct: ["tabelaAfetada"],
      select: { tabelaAfetada: true },
      orderBy: { tabelaAfetada: "asc" },
    }),
  ]);
  return {
    acoes: acoes.map((a) => a.acao),
    tabelas: tabelas.map((t) => t.tabelaAfetada),
  };
}
