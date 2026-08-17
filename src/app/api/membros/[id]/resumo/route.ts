import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { buscarResumoMembro } from "@/lib/membroResumo";

// Resumo (foto grande, nascimento, equipe, próxima escala) usado pelo hover
// card de pessoa — visível a qualquer usuário autenticado, mesmo dado já
// exposto hoje em telas como /aniversariantes e /membros.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const resumo = await buscarResumoMembro(id);
  if (!resumo) {
    return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
  }

  return NextResponse.json(resumo);
}
