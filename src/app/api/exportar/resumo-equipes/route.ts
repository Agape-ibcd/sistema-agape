import type { NextRequest } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import {
  resolverFiltros,
  escopoDoUsuario,
  carregarPresencas,
  seriesPorEquipe,
  seriesPorTipo,
} from "@/lib/dashboard";
import { planilhaResumoEquipes, respostaXlsx } from "@/lib/exportar";
import { paramsDaUrl, sufixoPeriodo } from "../_util";

// Resumo por equipe + por tipo de culto. Restrito à visão geral (admin/super):
// líderes/membros não exportam comparativos entre equipes.
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return new Response("Não autenticado", { status: 401 });
  if (escopoDoUsuario(usuario) !== "geral") {
    return new Response("Acesso negado", { status: 403 });
  }

  const filtros = resolverFiltros(usuario, paramsDaUrl(req));
  const linhas = await carregarPresencas(filtros);
  const buffer = await planilhaResumoEquipes(
    seriesPorEquipe(linhas),
    seriesPorTipo(linhas),
  );
  return respostaXlsx(buffer, `resumo-equipes_${sufixoPeriodo(filtros)}.xlsx`);
}
