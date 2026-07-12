import type { NextRequest } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import {
  resolverFiltros,
  carregarPresencas,
  desempenhoIndividual,
} from "@/lib/dashboard";
import { planilhaResumoMembros, respostaXlsx } from "@/lib/exportar";
import { paramsDaUrl, sufixoPeriodo } from "../_util";

// Resumo consolidado por membro (respeita os filtros da tela).
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return new Response("Não autenticado", { status: 401 });

  const filtros = resolverFiltros(usuario, paramsDaUrl(req));
  const linhas = await carregarPresencas(filtros);
  const buffer = await planilhaResumoMembros(desempenhoIndividual(linhas));
  return respostaXlsx(buffer, `resumo-membros_${sufixoPeriodo(filtros)}.xlsx`);
}
