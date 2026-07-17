import "server-only";
import { Resend } from "resend";

// ─────────────────────────────────────────────────────────────────────────
// Envio de e-mail (Etapa 6). Provedor: Resend. Sem domínio verificado na
// conta Resend, o remetente `onboarding@resend.dev` só entrega ao e-mail
// dono da conta — verificar um domínio no painel do Resend para enviar aos
// membros de fato.
// ─────────────────────────────────────────────────────────────────────────

const SUFIXO_EMAIL_SINTETICO = "@membros.agape.local";

// Cadastro em massa (migração da planilha) atribuiu esse domínio a quem não
// tinha e-mail próprio — não é entregável, nunca tentar enviar para lá.
export function ehEmailSintetico(email: string): boolean {
  return email.toLowerCase().endsWith(SUFIXO_EMAIL_SINTETICO);
}

let clienteResend: Resend | null = null;

function obterCliente(): Resend {
  if (!clienteResend) {
    const chave = process.env.RESEND_API_KEY;
    if (!chave) throw new Error("RESEND_API_KEY ausente no .env");
    clienteResend = new Resend(chave);
  }
  return clienteResend;
}

export type ResultadoEnvioEmail =
  | { ok: true; id: string }
  | { ok: false; erro: string };

export async function enviarEmail(params: {
  para: string;
  assunto: string;
  html: string;
}): Promise<ResultadoEnvioEmail> {
  if (ehEmailSintetico(params.para)) {
    return { ok: false, erro: "e-mail sintético (não entregável)" };
  }

  const remetente = process.env.EMAIL_REMETENTE || "Ministério Ágape <onboarding@resend.dev>";

  try {
    const { data, error } = await obterCliente().emails.send({
      from: remetente,
      to: params.para,
      subject: params.assunto,
      html: params.html,
    });
    if (error) return { ok: false, erro: error.message };
    return { ok: true, id: data?.id ?? "" };
  } catch (erro) {
    return {
      ok: false,
      erro: erro instanceof Error ? erro.message : "falha desconhecida no envio",
    };
  }
}
