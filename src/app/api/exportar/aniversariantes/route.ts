import type { NextRequest } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import {
  aniversariantesDoMes,
  hojeSaoPaulo,
  nomeMes,
} from "@/lib/aniversariantes";
import { planilhaAniversariantes, respostaXlsx } from "@/lib/exportar";

// Aniversariantes de um mês (padrão: mês corrente).
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return new Response("Não autenticado", { status: 401 });

  const hoje = hojeSaoPaulo();
  const pedido = Number(req.nextUrl.searchParams.get("mes"));
  const mes =
    Number.isInteger(pedido) && pedido >= 1 && pedido <= 12 ? pedido : hoje.mes;

  const lista = await aniversariantesDoMes(hoje, mes);
  const buffer = await planilhaAniversariantes(lista, nomeMes(mes));
  return respostaXlsx(
    buffer,
    `aniversariantes_${String(mes).padStart(2, "0")}.xlsx`,
  );
}
