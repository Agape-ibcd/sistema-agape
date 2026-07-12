import type { NextRequest } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import {
  resolverFiltros,
  carregarPresencas,
  registrosDetalhados,
} from "@/lib/dashboard";
import {
  planilhaPresencas,
  csvPresencas,
  respostaXlsx,
  respostaCsv,
} from "@/lib/exportar";
import { paramsDaUrl, sufixoPeriodo } from "../_util";

// Presença detalhada, respeitando os filtros da tela. Inclui as linhas
// excluídas (com status excluído/restaurado) para trilha de auditoria — porém
// os KPIs do dashboard continuam contando apenas as ativas.
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return new Response("Não autenticado", { status: 401 });

  const params = paramsDaUrl(req);
  const filtros = resolverFiltros(usuario, params);
  const linhas = await carregarPresencas(filtros, true);
  const registros = registrosDetalhados(linhas);

  const formato = req.nextUrl.searchParams.get("formato");
  const base = `presencas_${sufixoPeriodo(filtros)}`;

  if (formato === "csv") {
    return respostaCsv(csvPresencas(registros), `${base}.csv`);
  }
  const buffer = await planilhaPresencas(registros);
  return respostaXlsx(buffer, `${base}.xlsx`);
}
