"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";
import type { NivelAcesso } from "@prisma/client";
import { ROTULO_NIVEL } from "@/lib/rbac";

const NIVEIS: NivelAcesso[] = ["membro", "lider", "admin", "super_admin"];

// Cliente admin do Supabase Auth (service role) — só no servidor.
function authAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Configuração do Supabase ausente (URL/SERVICE_ROLE_KEY).");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).auth.admin;
}

// Altera o nível de acesso de um membro (matriz RBAC do PDF).
export async function alterarNivel(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_usuarios");
  const membroId = String(formData.get("membroId") ?? "");
  const nivel = String(formData.get("nivel") ?? "") as NivelAcesso;

  if (!NIVEIS.includes(nivel)) return falha("Nível de acesso inválido.");
  if (membroId === usuario.membroId) {
    return falha("Você não pode alterar o próprio nível de acesso.");
  }

  try {
    const membro = await prisma.membro.findUnique({ where: { id: membroId } });
    if (!membro) return falha("Membro não encontrado.");
    if (membro.nivelAcesso === nivel) {
      return falha(`${membro.nomeCompleto} já é ${ROTULO_NIVEL[nivel]}.`);
    }

    // Nunca deixar o sistema sem super admin.
    if (membro.nivelAcesso === "super_admin") {
      const outros = await prisma.membro.count({
        where: { nivelAcesso: "super_admin", id: { not: membroId }, status: "ativo" },
      });
      if (outros === 0) {
        return falha("Não é possível rebaixar o único Super Administrador ativo.");
      }
    }

    await prisma.membro.update({
      where: { id: membroId },
      data: { nivelAcesso: nivel },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "editar",
      tabelaAfetada: "membros",
      registroId: membroId,
      dadosAnteriores: { nivelAcesso: membro.nivelAcesso },
      dadosNovos: { nivelAcesso: nivel },
    });

    revalidatePath("/usuarios");
    return sucesso(
      `${membro.nomeCompleto} agora é ${ROTULO_NIVEL[nivel]}.`,
    );
  } catch (erro) {
    return falha(
      `Erro ao alterar nível: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Concede acesso de login: cria o usuário no Supabase Auth com a senha
// inicial definida pelo super admin e vincula ao cadastro do membro.
export async function concederAcesso(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_usuarios");
  const membroId = String(formData.get("membroId") ?? "");
  const senha = String(formData.get("senha") ?? "");

  if (senha.length < 8) return falha("A senha inicial deve ter pelo menos 8 caracteres.");

  try {
    const membro = await prisma.membro.findUnique({ where: { id: membroId } });
    if (!membro) return falha("Membro não encontrado.");
    if (membro.authUserId) return falha("Este membro já tem acesso de login.");
    if (membro.email.endsWith("@membros.agape.local")) {
      return falha(
        "E-mail sintético da migração — cadastre o e-mail real do membro antes de conceder acesso.",
      );
    }

    const { data, error } = await authAdmin().createUser({
      email: membro.email,
      password: senha,
      email_confirm: true,
    });
    if (error) return falha(`Supabase Auth: ${error.message}`);

    await prisma.membro.update({
      where: { id: membroId },
      data: { authUserId: data.user.id },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "conceder_acesso",
      tabelaAfetada: "membros",
      registroId: membroId,
      dadosNovos: { email: membro.email, authUserId: data.user.id },
    });

    revalidatePath("/usuarios");
    return sucesso(
      `Acesso criado para ${membro.nomeCompleto} (${membro.email}). Oriente a troca da senha no primeiro login.`,
    );
  } catch (erro) {
    return falha(
      `Erro ao conceder acesso: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Redefine a senha de um usuário que já tem login.
export async function redefinirSenha(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_usuarios");
  const membroId = String(formData.get("membroId") ?? "");
  const senha = String(formData.get("senha") ?? "");

  if (senha.length < 8) return falha("A nova senha deve ter pelo menos 8 caracteres.");

  try {
    const membro = await prisma.membro.findUnique({ where: { id: membroId } });
    if (!membro?.authUserId) return falha("Este membro não tem acesso de login.");

    const { error } = await authAdmin().updateUserById(membro.authUserId, {
      password: senha,
    });
    if (error) return falha(`Supabase Auth: ${error.message}`);

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "redefinir_senha",
      tabelaAfetada: "membros",
      registroId: membroId,
      dadosNovos: { email: membro.email },
    });

    revalidatePath("/usuarios");
    return sucesso(`Senha redefinida para ${membro.nomeCompleto}.`);
  } catch (erro) {
    return falha(
      `Erro ao redefinir senha: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}
