import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { can, nivelPeloMenos, type Permissao } from "@/lib/rbac";
import type { NivelAcesso } from "@prisma/client";

// Representa o usuário logado: a sessão do Supabase (auth) + o perfil em MEMBROS.
export type UsuarioAtual = {
  authUserId: string;
  email: string;
  membroId: string;
  nomeCompleto: string;
  nivelAcesso: NivelAcesso;
  equipeId: string | null;
  equipeNome: string | null;
  fotoUrl: string | null;
};

// Retorna o usuário logado (ou null). Combina a sessão do Supabase Auth com o
// registro correspondente em MEMBROS (vínculo por auth_user_id, fallback por email).
// `cache()` dedupe por requisição: layout + page chamam isso independentemente
// a cada navegação — sem isso, cada clique no menu repetia a consulta ao
// Supabase Auth e ao Prisma duas vezes. O cache é por requisição (não entre
// usuários nem entre navegações), então nenhuma verificação deixa de rodar.
export const getUsuarioAtual = cache(async (): Promise<UsuarioAtual | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const membro = await prisma.membro.findFirst({
    where: {
      OR: [
        { authUserId: user.id },
        ...(user.email ? [{ email: user.email }] : []),
      ],
    },
    include: { equipe: { select: { nome: true } } },
  });

  if (!membro) return null;

  // Membro inativo perde o acesso ao sistema — vale também para sessões que
  // já estavam abertas quando a inativação aconteceu.
  if (membro.status === "inativo") return null;

  return {
    authUserId: user.id,
    email: membro.email,
    membroId: membro.id,
    nomeCompleto: membro.nomeCompleto,
    nivelAcesso: membro.nivelAcesso,
    equipeId: membro.equipeId,
    equipeNome: membro.equipe?.nome ?? null,
    fotoUrl: membro.fotoUrl,
  };
});

// Exige sessão válida; redireciona ao login caso contrário.
export async function requireUsuario(): Promise<UsuarioAtual> {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}

// Exige uma permissão específica; redireciona a /nao-autorizado se faltar.
export async function requirePermissao(
  permissao: Permissao,
): Promise<UsuarioAtual> {
  const usuario = await requireUsuario();
  if (!can(usuario.nivelAcesso, permissao)) redirect("/nao-autorizado");
  return usuario;
}

// Exige nível mínimo na hierarquia (membro < lider < admin < super_admin).
export async function requireNivel(
  minimo: NivelAcesso,
): Promise<UsuarioAtual> {
  const usuario = await requireUsuario();
  if (!nivelPeloMenos(usuario.nivelAcesso, minimo)) redirect("/nao-autorizado");
  return usuario;
}
