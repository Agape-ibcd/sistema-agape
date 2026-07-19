import "server-only";
import { randomInt, randomUUID, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { enviarEmail, ehEmailSintetico } from "@/lib/email";
import { enviarTelegram } from "@/lib/telegram";

// ─────────────────────────────────────────────────────────────────────────
// Recuperação de senha por código (Sessão 2). Fluxo público, sem sessão de
// usuário — a segurança é: código de 6 dígitos guardado só como HASH, com
// expiração curta (15 min), limite de tentativas (5) e uso único; ao acertar
// o código gera-se um tokenReset opaco que autoriza a troca. Só depois de
// definir a nova senha e refazer o login o membro tem acesso ao sistema.
// ─────────────────────────────────────────────────────────────────────────

const VALIDADE_MIN = 15;
const MAX_TENTATIVAS = 5;
const REENVIO_MIN_SEGUNDOS = 60; // evita spam de reenvio

function hashCodigo(codigo: string): string {
  return createHash("sha256").update(codigo).digest("hex");
}

function gerarCodigo(): string {
  // 6 dígitos, com zeros à esquerda (000000–999999).
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

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

export type CanalUsado = "email" | "telegram";

// Resultado da solicitação. `enviadoPor` só é preenchido internamente (para
// a auditoria/UX); a resposta ao usuário é sempre genérica (anti-enumeração).
export type ResultadoSolicitacao = {
  // true quando havia uma conta elegível e o código foi enviado por ≥1 canal.
  enviado: boolean;
  canais: CanalUsado[];
};

// Passo 1 — gera e envia o código. NUNCA revela se o e-mail existe: quem
// chama deve responder de forma genérica independentemente do retorno.
export async function solicitarCodigoRecuperacao(
  emailBruto: string,
): Promise<ResultadoSolicitacao> {
  const email = emailBruto.trim().toLowerCase();
  const vazio: ResultadoSolicitacao = { enviado: false, canais: [] };
  if (!email) return vazio;

  const membro = await prisma.membro.findUnique({ where: { email } });
  // Só quem tem login (authUserId) e não está inativo pode recuperar senha.
  if (!membro || !membro.authUserId || membro.status === "inativo") return vazio;

  // Anti-spam: se já existe um código recente ainda válido, não gera outro.
  const recente = await prisma.recuperacaoSenha.findFirst({
    where: {
      membroId: membro.id,
      usado: false,
      criadoEm: { gt: new Date(Date.now() - REENVIO_MIN_SEGUNDOS * 1000) },
    },
  });
  if (recente) {
    // Já foi enviado há pouco — trata como "enviado" para a resposta genérica,
    // sem disparar de novo.
    return { enviado: true, canais: [] };
  }

  // Invalida códigos anteriores não usados deste membro.
  await prisma.recuperacaoSenha.updateMany({
    where: { membroId: membro.id, usado: false },
    data: { usado: true },
  });

  const codigo = gerarCodigo();
  await prisma.recuperacaoSenha.create({
    data: {
      membroId: membro.id,
      codigoHash: hashCodigo(codigo),
      expiraEm: new Date(Date.now() + VALIDADE_MIN * 60 * 1000),
    },
  });

  const primeiroNome = membro.nomeCompleto.split(" ")[0];
  const canais: CanalUsado[] = [];

  // E-mail (se entregável). Recuperação é ação pedida pelo próprio usuário,
  // então ignora a preferência notifEmail — é segurança, não notificação.
  console.log("[recuperacao] membro.email:", membro.email, "sintético?", ehEmailSintetico(membro.email));
  if (!ehEmailSintetico(membro.email)) {
    const r = await enviarEmail({
      para: membro.email,
      assunto: "Código de recuperação — Sistema Ágape",
      html: [
        `<p>Olá, ${primeiroNome}.</p>`,
        `<p>Seu código para redefinir a senha do Sistema Ágape é:</p>`,
        `<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${codigo}</p>`,
        `<p>Ele vale por ${VALIDADE_MIN} minutos. Se você não pediu isso, ignore este e-mail.</p>`,
      ].join(""),
    });
    console.log("[recuperacao] resultado enviarEmail:", JSON.stringify(r));
    if (r.ok) canais.push("email");
  }

  // Telegram (se vinculado).
  console.log("[recuperacao] membro.telegramChatId:", membro.telegramChatId);
  if (membro.telegramChatId) {
    const r = await enviarTelegram({
      chatId: membro.telegramChatId,
      texto:
        `Olá, ${primeiroNome}. Seu código para redefinir a senha do Sistema Ágape é: ${codigo}\n` +
        `Vale por ${VALIDADE_MIN} minutos. Se você não pediu isso, ignore esta mensagem.`,
    });
    console.log("[recuperacao] resultado enviarTelegram:", JSON.stringify(r));
    if (r.ok) canais.push("telegram");
  }
  console.log("[recuperacao] canais finais:", canais);

  return { enviado: canais.length > 0, canais };
}

export type ResultadoVerificacao =
  | { ok: true; tokenReset: string }
  | { ok: false; motivo: string };

// Passo 2 — verifica o código. Limita tentativas e expira. Ao acertar, gera
// o tokenReset (uso único) que o passo 3 exige.
export async function verificarCodigoRecuperacao(
  emailBruto: string,
  codigoBruto: string,
): Promise<ResultadoVerificacao> {
  const email = emailBruto.trim().toLowerCase();
  const codigo = codigoBruto.trim();
  const generico = "Código inválido ou expirado. Solicite um novo.";

  if (!email || !/^\d{6}$/.test(codigo)) {
    return { ok: false, motivo: generico };
  }

  const membro = await prisma.membro.findUnique({ where: { email } });
  if (!membro) return { ok: false, motivo: generico };

  const registro = await prisma.recuperacaoSenha.findFirst({
    where: { membroId: membro.id, usado: false, expiraEm: { gt: new Date() } },
    orderBy: { criadoEm: "desc" },
  });
  if (!registro) return { ok: false, motivo: generico };

  if (registro.tentativas >= MAX_TENTATIVAS) {
    await prisma.recuperacaoSenha.update({
      where: { id: registro.id },
      data: { usado: true },
    });
    return { ok: false, motivo: "Muitas tentativas. Solicite um novo código." };
  }

  if (hashCodigo(codigo) !== registro.codigoHash) {
    const atualizado = await prisma.recuperacaoSenha.update({
      where: { id: registro.id },
      data: { tentativas: { increment: 1 } },
    });
    const restantes = MAX_TENTATIVAS - atualizado.tentativas;
    return {
      ok: false,
      motivo:
        restantes > 0
          ? `Código incorreto. Você ainda tem ${restantes} tentativa(s).`
          : "Muitas tentativas. Solicite um novo código.",
    };
  }

  const tokenReset = randomUUID().replace(/-/g, "");
  await prisma.recuperacaoSenha.update({
    where: { id: registro.id },
    data: { tokenReset },
  });
  return { ok: true, tokenReset };
}

export type ResultadoRedefinicao = { ok: true } | { ok: false; motivo: string };

// Passo 3 — troca a senha usando o tokenReset. Marca o registro como usado
// (uso único) e atualiza a senha via Supabase Auth admin.
export async function redefinirSenhaComToken(
  tokenReset: string,
  senhaNova: string,
): Promise<ResultadoRedefinicao> {
  if (senhaNova.length < 8) {
    return { ok: false, motivo: "A nova senha deve ter pelo menos 8 caracteres." };
  }

  const registro = await prisma.recuperacaoSenha.findUnique({
    where: { tokenReset },
    include: { membro: true },
  });
  if (!registro || registro.usado || registro.expiraEm < new Date()) {
    return { ok: false, motivo: "Sessão de recuperação expirada. Comece de novo." };
  }
  if (!registro.membro.authUserId) {
    return { ok: false, motivo: "Este cadastro não tem acesso de login." };
  }

  const { error } = await authAdmin().updateUserById(registro.membro.authUserId, {
    password: senhaNova,
  });
  if (error) return { ok: false, motivo: `Não foi possível trocar a senha: ${error.message}` };

  await prisma.recuperacaoSenha.update({
    where: { id: registro.id },
    data: { usado: true },
  });

  return { ok: true };
}

// Só para a auditoria/UX do passo 3 (nome do membro dono do token, sem expor
// nada sensível na URL).
export async function membroDoTokenReset(tokenReset: string): Promise<string | null> {
  const registro = await prisma.recuperacaoSenha.findUnique({
    where: { tokenReset },
    include: { membro: { select: { id: true } } },
  });
  if (!registro || registro.usado || registro.expiraEm < new Date()) return null;
  return registro.membro.id;
}
