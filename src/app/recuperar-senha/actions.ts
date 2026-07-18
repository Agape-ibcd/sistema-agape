"use server";

import { writeAudit } from "@/lib/audit";
import {
  solicitarCodigoRecuperacao,
  verificarCodigoRecuperacao,
  redefinirSenhaComToken,
  membroDoTokenReset,
} from "@/lib/recuperacaoSenha";

// Página PÚBLICA (sem sessão). A segurança está na lib (código hasheado,
// expiração, limite de tentativas, token de uso único). As respostas de
// "pedir código" são sempre genéricas — nunca revelam se o e-mail existe.
// As actions recebem argumentos diretos (não FormData) porque o cliente as
// chama manualmente via useTransition (evita setState em useEffect, proibido
// pelo lint deste repo).

export type RespostaSimples = { ok: boolean; message: string };

export async function pedirCodigo(email: string): Promise<RespostaSimples> {
  if (!email.trim()) {
    return { ok: false, message: "Informe o seu e-mail." };
  }

  await solicitarCodigoRecuperacao(email);

  // Resposta genérica (anti-enumeração): sempre a mesma, exista ou não a conta.
  return {
    ok: true,
    message:
      "Se houver uma conta com esse e-mail, enviamos um código de 6 dígitos por e-mail e/ou Telegram.",
  };
}

export type RespostaVerificacao =
  | { ok: true; tokenReset: string }
  | { ok: false; message: string };

export async function verificarCodigo(
  email: string,
  codigo: string,
): Promise<RespostaVerificacao> {
  const resultado = await verificarCodigoRecuperacao(email, codigo);
  if (resultado.ok) return { ok: true, tokenReset: resultado.tokenReset };
  return { ok: false, message: resultado.motivo };
}

export async function redefinirSenha(
  tokenReset: string,
  senha: string,
  confirma: string,
): Promise<RespostaSimples> {
  if (senha.length < 8) {
    return { ok: false, message: "A nova senha deve ter pelo menos 8 caracteres." };
  }
  if (senha !== confirma) {
    return { ok: false, message: "A confirmação não confere com a nova senha." };
  }

  const membroId = await membroDoTokenReset(tokenReset);
  const resultado = await redefinirSenhaComToken(tokenReset, senha);
  if (!resultado.ok) {
    return { ok: false, message: resultado.motivo };
  }

  if (membroId) {
    await writeAudit({
      usuarioId: membroId,
      acao: "recuperar_senha",
      tabelaAfetada: "membros",
      registroId: membroId,
    });
  }

  return {
    ok: true,
    message: "Senha redefinida com sucesso! Agora entre com a sua nova senha.",
  };
}
