"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";
import { aplicarStatusMembro } from "@/lib/statusMembro";
import type { NivelAcesso, StatusMembro } from "@prisma/client";
import { ROTULO_NIVEL } from "@/lib/rbac";

const NIVEIS: NivelAcesso[] = ["membro", "monitor", "lider", "admin", "super_admin"];

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

    // Monitor não pertence a nenhuma equipe — o vínculo é removido.
    const viraMonitor = nivel === "monitor" && membro.equipeId !== null;
    await prisma.membro.update({
      where: { id: membroId },
      data: { nivelAcesso: nivel, ...(viraMonitor ? { equipeId: null } : {}) },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "editar",
      tabelaAfetada: "membros",
      registroId: membroId,
      dadosAnteriores: { nivelAcesso: membro.nivelAcesso, equipeId: membro.equipeId },
      dadosNovos: {
        nivelAcesso: nivel,
        equipeId: viraMonitor ? null : membro.equipeId,
      },
    });

    revalidatePath("/usuarios");
    revalidatePath("/membros");
    return sucesso(
      `${membro.nomeCompleto} agora é ${ROTULO_NIVEL[nivel]}.${viraMonitor ? " Saiu da equipe — monitor não pertence a equipes." : ""}`,
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
    if (membro.status === "inativo") {
      return falha("Membro inativo — reative o cadastro antes de conceder acesso.");
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
    // E-mails sintéticos da migração funcionam para LOGIN, mas não recebem
    // e-mail — vale o aviso para atualizar o cadastro quando possível.
    const avisoSintetico = membro.email.endsWith("@membros.agape.local")
      ? " Atenção: e-mail sintético da migração — o login funciona, mas este endereço não recebe e-mails; atualize o e-mail real em Membros quando possível."
      : "";
    return sucesso(
      `Acesso criado para ${membro.nomeCompleto} (${membro.email}). Oriente a troca da senha no primeiro login.${avisoSintetico}`,
    );
  } catch (erro) {
    return falha(
      `Erro ao conceder acesso: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Concede acesso de login a TODOS os membros ativos que ainda não têm,
// com a mesma senha inicial (cada um troca a sua em Meu Perfil).
export async function concederAcessoTodos(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_usuarios");
  const senha = String(formData.get("senha") ?? "");
  if (senha.length < 8) {
    return falha("A senha inicial deve ter pelo menos 8 caracteres.");
  }

  try {
    const pendentes = await prisma.membro.findMany({
      // Afastados (temporários) também recebem acesso; só inativos ficam fora.
      where: { authUserId: null, status: { not: "inativo" } },
      orderBy: { nomeCompleto: "asc" },
      select: { id: true, nomeCompleto: true, email: true },
    });
    if (pendentes.length === 0) {
      return falha("Todos os membros ativos já têm acesso de login.");
    }

    const admin = authAdmin();
    let criados = 0;
    const falhas: string[] = [];
    for (const m of pendentes) {
      const { data, error } = await admin.createUser({
        email: m.email,
        password: senha,
        email_confirm: true,
      });
      if (error || !data.user) {
        falhas.push(`${m.nomeCompleto} (${error?.message ?? "erro"})`);
        continue;
      }
      await prisma.membro.update({
        where: { id: m.id },
        data: { authUserId: data.user.id },
      });
      criados += 1;
    }

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "conceder_acesso_em_massa",
      tabelaAfetada: "membros",
      dadosNovos: { criados, falhas },
    });

    revalidatePath("/usuarios");
    const resumoFalhas =
      falhas.length > 0 ? ` Falharam ${falhas.length}: ${falhas.join("; ")}.` : "";
    return sucesso(
      `Acesso criado para ${criados} membro(s) com a senha inicial informada. Oriente cada um a trocar a senha em Meu Perfil.${resumoFalhas}`,
    );
  } catch (erro) {
    return falha(
      `Erro no acesso em massa: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Revoga o acesso de login (apaga a conta no Supabase Auth). O CADASTRO do
// membro permanece intacto — membros nunca são excluídos (regra do sistema).
export async function revogarAcesso(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_usuarios");
  const membroId = String(formData.get("membroId") ?? "");

  if (membroId === usuario.membroId) {
    return falha("Você não pode revogar o próprio acesso.");
  }

  try {
    const membro = await prisma.membro.findUnique({ where: { id: membroId } });
    if (!membro?.authUserId) return falha("Este membro não tem acesso de login.");

    const { error } = await authAdmin().deleteUser(membro.authUserId);
    if (error) return falha(`Supabase Auth: ${error.message}`);

    await prisma.membro.update({
      where: { id: membroId },
      data: { authUserId: null },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "revogar_acesso",
      tabelaAfetada: "membros",
      registroId: membroId,
      dadosAnteriores: { email: membro.email, authUserId: membro.authUserId },
    });

    revalidatePath("/usuarios");
    return sucesso(
      `Acesso de ${membro.nomeCompleto} revogado. O cadastro e o histórico permanecem.`,
    );
  } catch (erro) {
    return falha(
      `Erro ao revogar acesso: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
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

// ─────────────────────────────────────────────────────────────────────────
// Ações em MASSA (seleção múltipla na lista). Cada uma repete as validações
// individuais por membro e devolve um resumo: aplicados + pulados com motivo.
// ─────────────────────────────────────────────────────────────────────────

function idsSelecionados(formData: FormData): string[] {
  return formData
    .getAll("membroIds")
    .map((v) => String(v).trim())
    .filter(Boolean);
}

function resumoMassa(aplicados: number, pulados: string[], verbo: string): string {
  const base = `${verbo} aplicada a ${aplicados} membro(s).`;
  if (pulados.length === 0) return base;
  return `${base} Pulados ${pulados.length}: ${pulados.join("; ")}.`;
}

// Muda o status (ativo/afastado/inativo) dos selecionados.
export async function definirStatusVarios(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_usuarios");
  const ids = idsSelecionados(formData);
  const status = String(formData.get("status") ?? "") as StatusMembro;
  const motivo = String(formData.get("motivo") ?? "");
  const retornoPrevisto = String(formData.get("retornoPrevisto") ?? "");

  if (ids.length === 0) return falha("Nenhum membro selecionado.");
  if (!["ativo", "afastado", "inativo"].includes(status)) {
    return falha("Status inválido.");
  }

  try {
    let aplicados = 0;
    const pulados: string[] = [];
    for (const id of ids) {
      const r = await aplicarStatusMembro(usuario, id, status, motivo, retornoPrevisto);
      if (r.ok) aplicados += 1;
      else pulados.push(r.message);
    }
    revalidatePath("/usuarios");
    revalidatePath("/membros");
    const verbo =
      status === "inativo" ? "Inativação" : status === "afastado" ? "Afastamento" : "Reativação";
    return sucesso(resumoMassa(aplicados, pulados, verbo));
  } catch (erro) {
    return falha(
      `Erro na ação em massa: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Concede acesso de login aos selecionados com a mesma senha inicial.
export async function concederAcessoVarios(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_usuarios");
  const ids = idsSelecionados(formData);
  const senha = String(formData.get("senha") ?? "");

  if (ids.length === 0) return falha("Nenhum membro selecionado.");
  if (senha.length < 8) return falha("A senha inicial deve ter pelo menos 8 caracteres.");

  try {
    const admin = authAdmin();
    let aplicados = 0;
    const pulados: string[] = [];
    for (const id of ids) {
      const membro = await prisma.membro.findUnique({ where: { id } });
      if (!membro) {
        pulados.push("membro não encontrado");
        continue;
      }
      if (membro.authUserId) {
        pulados.push(`${membro.nomeCompleto} (já tem acesso)`);
        continue;
      }
      if (membro.status === "inativo") {
        pulados.push(`${membro.nomeCompleto} (inativo)`);
        continue;
      }
      const { data, error } = await admin.createUser({
        email: membro.email,
        password: senha,
        email_confirm: true,
      });
      if (error || !data.user) {
        pulados.push(`${membro.nomeCompleto} (${error?.message ?? "erro"})`);
        continue;
      }
      await prisma.membro.update({
        where: { id },
        data: { authUserId: data.user.id },
      });
      await writeAudit({
        usuarioId: usuario.membroId,
        acao: "conceder_acesso",
        tabelaAfetada: "membros",
        registroId: id,
        dadosNovos: { email: membro.email, authUserId: data.user.id },
      });
      aplicados += 1;
    }
    revalidatePath("/usuarios");
    return sucesso(
      `${resumoMassa(aplicados, pulados, "Concessão de acesso")} Oriente cada um a trocar a senha em Meu Perfil.`,
    );
  } catch (erro) {
    return falha(
      `Erro na ação em massa: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Revoga o acesso de login dos selecionados (cadastros permanecem).
export async function revogarAcessoVarios(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_usuarios");
  const ids = idsSelecionados(formData);
  if (ids.length === 0) return falha("Nenhum membro selecionado.");

  try {
    const admin = authAdmin();
    let aplicados = 0;
    const pulados: string[] = [];
    for (const id of ids) {
      if (id === usuario.membroId) {
        pulados.push("você (não pode revogar o próprio acesso)");
        continue;
      }
      const membro = await prisma.membro.findUnique({ where: { id } });
      if (!membro?.authUserId) {
        pulados.push(`${membro?.nomeCompleto ?? "?"} (sem acesso)`);
        continue;
      }
      const { error } = await admin.deleteUser(membro.authUserId);
      if (error) {
        pulados.push(`${membro.nomeCompleto} (${error.message})`);
        continue;
      }
      await prisma.membro.update({ where: { id }, data: { authUserId: null } });
      await writeAudit({
        usuarioId: usuario.membroId,
        acao: "revogar_acesso",
        tabelaAfetada: "membros",
        registroId: id,
        dadosAnteriores: { email: membro.email, authUserId: membro.authUserId },
      });
      aplicados += 1;
    }
    revalidatePath("/usuarios");
    return sucesso(resumoMassa(aplicados, pulados, "Revogação de acesso"));
  } catch (erro) {
    return falha(
      `Erro na ação em massa: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Altera o nível de acesso dos selecionados (mesmas guardas da ação unitária).
export async function alterarNivelVarios(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_usuarios");
  const ids = idsSelecionados(formData);
  const nivel = String(formData.get("nivel") ?? "") as NivelAcesso;

  if (ids.length === 0) return falha("Nenhum membro selecionado.");
  if (!NIVEIS.includes(nivel)) return falha("Nível de acesso inválido.");

  try {
    let aplicados = 0;
    const pulados: string[] = [];
    for (const id of ids) {
      if (id === usuario.membroId) {
        pulados.push("você (não pode alterar o próprio nível)");
        continue;
      }
      const membro = await prisma.membro.findUnique({ where: { id } });
      if (!membro) {
        pulados.push("membro não encontrado");
        continue;
      }
      if (membro.nivelAcesso === nivel) {
        pulados.push(`${membro.nomeCompleto} (já é ${ROTULO_NIVEL[nivel]})`);
        continue;
      }
      if (membro.nivelAcesso === "super_admin" && nivel !== "super_admin") {
        const outros = await prisma.membro.count({
          where: { nivelAcesso: "super_admin", id: { not: id }, status: "ativo" },
        });
        if (outros === 0) {
          pulados.push(`${membro.nomeCompleto} (único Super Admin ativo)`);
          continue;
        }
      }
      // Monitor não pertence a nenhuma equipe — o vínculo é removido.
      const viraMonitor = nivel === "monitor" && membro.equipeId !== null;
      await prisma.membro.update({
        where: { id },
        data: { nivelAcesso: nivel, ...(viraMonitor ? { equipeId: null } : {}) },
      });
      await writeAudit({
        usuarioId: usuario.membroId,
        acao: "editar",
        tabelaAfetada: "membros",
        registroId: id,
        dadosAnteriores: { nivelAcesso: membro.nivelAcesso, equipeId: membro.equipeId },
        dadosNovos: {
          nivelAcesso: nivel,
          equipeId: viraMonitor ? null : membro.equipeId,
        },
      });
      aplicados += 1;
    }
    revalidatePath("/usuarios");
    revalidatePath("/membros");
    return sucesso(
      resumoMassa(aplicados, pulados, `Mudança de nível para ${ROTULO_NIVEL[nivel]}`),
    );
  } catch (erro) {
    return falha(
      `Erro na ação em massa: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}
