"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";

// Troca obrigatória de senha após o super_admin enviar credenciais provisórias
// (deveTrocarSenha=true). Não pede a senha atual: o membro acabou de entrar com
// a provisória. Ao concluir, limpa a flag e leva ao dashboard.
export async function trocarSenhaObrigatoria(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requireUsuario();

  const senhaNova = String(formData.get("senhaNova") ?? "");
  const senhaConfirma = String(formData.get("senhaConfirma") ?? "");

  if (senhaNova.length < 8) return falha("A nova senha deve ter pelo menos 8 caracteres.");
  if (senhaNova !== senhaConfirma) return falha("A confirmação não confere com a nova senha.");

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: senhaNova });
    if (error) return falha(`Supabase Auth: ${error.message}`);

    await prisma.membro.update({
      where: { id: usuario.membroId },
      data: { deveTrocarSenha: false },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "trocar_senha_obrigatoria",
      tabelaAfetada: "membros",
      registroId: usuario.membroId,
    });
  } catch (erro) {
    return falha(
      `Erro ao definir a senha: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }

  // Fora do try: redirect() lança um controle de fluxo que não deve ser
  // capturado pelo catch acima.
  redirect("/dashboard");
  // Inalcançável — só para satisfazer o tipo de retorno.
  return sucesso("Senha alterada.");
}
