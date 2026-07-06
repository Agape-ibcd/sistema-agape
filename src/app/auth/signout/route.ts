import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

// Encerra a sessão do Supabase e volta ao login.
export async function POST(request: Request) {
  const usuario = await getUsuarioAtual();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  if (usuario) {
    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "logout",
      tabelaAfetada: "membros",
      registroId: usuario.membroId,
    });
  }

  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
