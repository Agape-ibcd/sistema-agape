import "server-only";
import type { NextRequest } from "next/server";
import { formatarDataISO } from "@/lib/recorrencia";
import type { FiltrosDashboard, ParamsDashboard } from "@/lib/dashboard";

// Extrai os parâmetros de filtro da querystring da requisição de exportação.
export function paramsDaUrl(req: NextRequest): ParamsDashboard {
  const sp = req.nextUrl.searchParams;
  return {
    inicio: sp.get("inicio") ?? undefined,
    fim: sp.get("fim") ?? undefined,
    equipe: sp.get("equipe") ?? undefined,
    tipo: sp.get("tipo") ?? undefined,
    membro: sp.get("membro") ?? undefined,
  };
}

// Sufixo "AAAAMMDD-AAAAMMDD" para nomear os arquivos pelo período.
export function sufixoPeriodo(filtros: FiltrosDashboard): string {
  const fmt = (d: Date) => formatarDataISO(d).replace(/-/g, "");
  return `${fmt(filtros.inicio)}-${fmt(filtros.fim)}`;
}
