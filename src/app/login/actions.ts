"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { falha, type EstadoAcao } from "@/lib/actions";

export async function login(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/dashboard");

  if (!email || !senha) {
    return falha("Informe e-mail e senha.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error || !data.user) {
    return falha("E-mail ou senha inválidos.");
  }

  // Garante o vínculo entre a conta de auth e o registro em MEMBROS, e registra
  // o último acesso + auditoria de login.
  const membro = await prisma.membro.findFirst({
    where: { OR: [{ authUserId: data.user.id }, { email }] },
  });

  if (!membro) {
    await supabase.auth.signOut();
    return falha(
      "Login válido, mas não há cadastro de membro vinculado a este e-mail. Fale com um administrador.",
    );
  }

  await prisma.membro.update({
    where: { id: membro.id },
    data: {
      ultimoAcesso: new Date(),
      authUserId: membro.authUserId ?? data.user.id,
    },
  });

  await writeAudit({
    usuarioId: membro.id,
    acao: "login",
    tabelaAfetada: "membros",
    registroId: membro.id,
  });

  const destino = redirectTo.startsWith("/") ? redirectTo : "/dashboard";
  redirect(destino);
}
