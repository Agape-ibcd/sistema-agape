"use server";

import { confirmarAlteracaoPerfil } from "@/lib/alteracaoPerfil";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";

// Página PÚBLICA (sem login) — a segurança é o token opaco com expiração
// (24h), não sessão de usuário. Ver src/lib/alteracaoPerfil.ts.
export async function confirmarAlteracaoDados(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const token = String(formData.get("token") ?? "");
  if (!token) return falha("Link inválido.");

  const resultado = await confirmarAlteracaoPerfil(token);
  if (!resultado.ok) return falha(resultado.motivo);

  return sucesso("Cadastro atualizado com sucesso!");
}
