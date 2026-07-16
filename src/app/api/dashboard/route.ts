import { NextResponse, type NextRequest } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { carregarDashboard, type ParamsDashboard } from "@/lib/dashboard";

// Dados do dashboard buscados pelo navegador (SWR) — evita repetir as ~5
// consultas Prisma em toda navegação. resolverFiltros() (dentro de
// carregarDashboard) re-deriva o escopo a partir do usuário reverificado
// aqui, então equipe/membro restritos vindos do cliente continuam sendo
// ignorados — mesma regra de hoje, nenhuma verificação muda.
export async function GET(request: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const params: ParamsDashboard = {
    inicio: sp.get("inicio") ?? undefined,
    fim: sp.get("fim") ?? undefined,
    equipe: sp.get("equipe") ?? undefined,
    tipo: sp.get("tipo") ?? undefined,
    membro: sp.get("membro") ?? undefined,
  };

  const dados = await carregarDashboard(usuario, params);
  return NextResponse.json(dados);
}
