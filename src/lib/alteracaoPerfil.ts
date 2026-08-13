import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { enviarEmail, ehEmailSintetico } from "@/lib/email";
import { enviarTelegram } from "@/lib/telegram";
import { writeAudit } from "@/lib/audit";
import { dispararNotificacaoPerfilEditado } from "@/lib/notificacoesEnvio";

// ─────────────────────────────────────────────────────────────────────────
// Edição de nome/e-mail/celular/nascimento pelo próprio membro (pedido do
// usuário em 2026-07-27, retomado em 2026-08-13 com o prazo ajustado de 2h
// para 24h e o escopo estendido a TODOS os níveis, não só monitor). A
// alteração não é aplicada na hora: fica pendente em
// AlteracaoPerfilPendente e só entra no cadastro quando o membro clica no
// link de confirmação (enviado ao e-mail/Telegram ATUAIS, não ao novo — é
// o canal já verificado do dono da conta). Mesmo padrão de token opaco +
// expiração de RecuperacaoSenha/ConfirmacaoEscala.
// ─────────────────────────────────────────────────────────────────────────

export const VALIDADE_HORAS = 24;

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

export type DadosPropostos = {
  nomeCompleto: string;
  email: string;
  celularWhatsapp: string | null;
  dataNascimento: Date | null;
};

export type ResultadoSolicitacao =
  | { ok: true; canais: ("email" | "telegram")[] }
  | { ok: false; motivo: string };

// Passo 1 — valida, cria o registro pendente e envia o link de confirmação
// para o e-mail/Telegram ATUAIS do membro (prova que quem pediu é quem tem
// acesso à conta — o novo e-mail só passa a valer depois de confirmado).
export async function solicitarAlteracaoPerfil(
  membroId: string,
  dados: DadosPropostos,
): Promise<ResultadoSolicitacao> {
  const nome = dados.nomeCompleto.trim();
  const email = dados.email.trim().toLowerCase();
  if (!nome) return { ok: false, motivo: "Informe o nome completo." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, motivo: "E-mail inválido." };
  }

  const atual = await prisma.membro.findUnique({ where: { id: membroId } });
  if (!atual) return { ok: false, motivo: "Cadastro não encontrado." };

  if (email !== atual.email.toLowerCase()) {
    const emailEmUso = await prisma.membro.findUnique({ where: { email } });
    if (emailEmUso && emailEmUso.id !== membroId) {
      return { ok: false, motivo: "Este e-mail já está em uso por outro cadastro." };
    }
  }

  // Sem canal para confirmar (e-mail sintético e sem Telegram vinculado) —
  // não dá pra provar que é o dono da conta. Precisa de um admin.
  const temEmail = !ehEmailSintetico(atual.email);
  const temTelegram = !!atual.telegramChatId;
  if (!temEmail && !temTelegram) {
    return {
      ok: false,
      motivo:
        "Seu cadastro não tem e-mail próprio nem Telegram vinculado para confirmar a alteração — peça a um administrador para atualizar seus dados.",
    };
  }

  // Invalida pedidos pendentes anteriores deste membro (só o último link vale).
  await prisma.alteracaoPerfilPendente.updateMany({
    where: { membroId, usado: false },
    data: { usado: true },
  });

  const token = randomUUID().replace(/-/g, "");
  await prisma.alteracaoPerfilPendente.create({
    data: {
      membroId,
      nomeCompleto: nome,
      email,
      celularWhatsapp: dados.celularWhatsapp,
      dataNascimento: dados.dataNascimento,
      token,
      expiraEm: new Date(Date.now() + VALIDADE_HORAS * 60 * 60 * 1000),
    },
  });

  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const link = `${appUrl}/confirmar-alteracao-perfil/${token}`;
  const primeiroNome = atual.nomeCompleto.split(" ")[0];
  const canais: ("email" | "telegram")[] = [];

  if (temEmail) {
    const r = await enviarEmail({
      para: atual.email,
      assunto: "Confirme a alteração do seu cadastro — Ministério Ágape",
      html: [
        `<p>Olá, ${primeiroNome}.</p>`,
        `<p>Você pediu para alterar dados do seu cadastro no Sistema Ágape. Para confirmar, clique no link abaixo:</p>`,
        `<p><a href="${link}">${link}</a></p>`,
        `<p>O link vale por ${VALIDADE_HORAS} horas. Se você não pediu essa alteração, ignore este e-mail — nada será mudado.</p>`,
      ].join(""),
    });
    if (r.ok) canais.push("email");
  }

  if (temTelegram && atual.telegramChatId) {
    const r = await enviarTelegram({
      chatId: atual.telegramChatId,
      texto:
        `Olá, ${primeiroNome}. Você pediu para alterar dados do seu cadastro no Sistema Ágape.\n` +
        `Para confirmar, acesse: ${link}\n` +
        `O link vale por ${VALIDADE_HORAS} horas. Se você não pediu essa alteração, ignore esta mensagem.`,
    });
    if (r.ok) canais.push("telegram");
  }

  if (canais.length === 0) {
    return {
      ok: false,
      motivo: "Não foi possível enviar o link de confirmação agora — tente novamente em instantes.",
    };
  }

  return { ok: true, canais };
}

export type ResultadoConfirmacao = { ok: true } | { ok: false; motivo: string };

// Passo 2 — aplica os dados propostos, sincroniza o e-mail de login no
// Supabase Auth (se mudou), audita e avisa líderes/admin/super (mesmo
// gatilho perfil_editado já usado na edição imediata de celular/nascimento).
export async function confirmarAlteracaoPerfil(token: string): Promise<ResultadoConfirmacao> {
  const registro = await prisma.alteracaoPerfilPendente.findUnique({
    where: { token },
    include: { membro: true },
  });
  if (!registro) return { ok: false, motivo: "Link inválido." };
  if (registro.usado) return { ok: false, motivo: "Este link já foi usado." };
  if (registro.expiraEm < new Date()) {
    return { ok: false, motivo: "Este link expirou — volte ao seu perfil e peça a alteração de novo." };
  }

  const emailMudou = registro.email.toLowerCase() !== registro.membro.email.toLowerCase();
  if (emailMudou) {
    const emailEmUso = await prisma.membro.findUnique({ where: { email: registro.email } });
    if (emailEmUso && emailEmUso.id !== registro.membroId) {
      return {
        ok: false,
        motivo: "Este e-mail passou a estar em uso por outro cadastro nesse meio tempo — peça a alteração de novo com outro e-mail.",
      };
    }
  }

  if (emailMudou && registro.membro.authUserId) {
    const { error } = await authAdmin().updateUserById(registro.membro.authUserId, {
      email: registro.email,
      email_confirm: true,
    });
    if (error) {
      return { ok: false, motivo: `Não foi possível atualizar o e-mail de login: ${error.message}` };
    }
  }

  const antes = {
    nomeCompleto: registro.membro.nomeCompleto,
    email: registro.membro.email,
    celularWhatsapp: registro.membro.celularWhatsapp,
    dataNascimento: registro.membro.dataNascimento?.toISOString() ?? null,
  };

  const membroAtualizado = await prisma.membro.update({
    where: { id: registro.membroId },
    data: {
      nomeCompleto: registro.nomeCompleto,
      email: registro.email,
      celularWhatsapp: registro.celularWhatsapp,
      dataNascimento: registro.dataNascimento,
    },
  });

  await prisma.alteracaoPerfilPendente.update({
    where: { id: registro.id },
    data: { usado: true },
  });

  await writeAudit({
    usuarioId: registro.membroId,
    acao: "confirmar_alteracao_perfil",
    tabelaAfetada: "membros",
    registroId: registro.membroId,
    dadosAnteriores: antes,
    dadosNovos: {
      nomeCompleto: membroAtualizado.nomeCompleto,
      email: membroAtualizado.email,
      celularWhatsapp: membroAtualizado.celularWhatsapp,
      dataNascimento: membroAtualizado.dataNascimento?.toISOString() ?? null,
    },
  });

  const mudou: string[] = [];
  if (antes.nomeCompleto !== membroAtualizado.nomeCompleto) mudou.push("nome");
  if (antes.email !== membroAtualizado.email) mudou.push("e-mail");
  if ((antes.celularWhatsapp ?? "") !== (membroAtualizado.celularWhatsapp ?? "")) mudou.push("celular");
  if (
    antes.dataNascimento !== (membroAtualizado.dataNascimento?.toISOString() ?? null)
  ) {
    mudou.push("data de nascimento");
  }
  await dispararNotificacaoPerfilEditado({
    membroId: registro.membroId,
    membroNome: membroAtualizado.nomeCompleto,
    equipeId: registro.membro.equipeId,
    detalhe: mudou.length ? `Campos alterados: ${mudou.join(", ")}.` : "Sem alterações de dados.",
  });

  return { ok: true };
}

// Só para a página pública mostrar o que vai mudar antes de confirmar, e
// para o /perfil avisar que já há um pedido pendente sem expor o token.
export async function alteracaoPendenteDoMembro(membroId: string) {
  const registro = await prisma.alteracaoPerfilPendente.findFirst({
    where: { membroId, usado: false, expiraEm: { gt: new Date() } },
    orderBy: { criadoEm: "desc" },
  });
  return registro;
}
