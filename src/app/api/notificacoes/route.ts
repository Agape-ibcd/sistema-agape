import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { carregarNotificacoes } from "@/lib/notificacoes";

// Notificações do sino buscadas pelo navegador (não mais no layout do
// servidor) — evita repetir 2 consultas ao banco em toda navegação, já que
// aniversariantes/escalas não mudam a cada clique de menu.
export async function GET() {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const notificacoes = await carregarNotificacoes(usuario);
  return NextResponse.json(notificacoes);
}
