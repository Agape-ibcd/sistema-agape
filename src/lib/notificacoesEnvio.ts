import "server-only";
import { prisma } from "@/lib/prisma";
import { hojeSaoPaulo } from "@/lib/aniversariantes";
import { enviarEmail, ehEmailSintetico } from "@/lib/email";

// ─────────────────────────────────────────────────────────────────────────
// Motor de disparo (Etapa 6). Só `aniversario_dia` está implementado nesta
// rodada — os demais gatilhos (nova_escala, escala_alterada, lembrete_vespera)
// já têm regra configurável no painel, mas o disparo chega numa próxima
// rodada (junto com Telegram e o cron de eventos).
// ─────────────────────────────────────────────────────────────────────────

function preencherTemplate(texto: string, dados: Record<string, string>): string {
  return texto.replace(/\{\{(\w+)\}\}/g, (_, chave: string) => dados[chave] ?? "");
}

function paraHtml(textoMultilinha: string): string {
  return textoMultilinha
    .split("\n")
    .map((linha) => `<p>${linha.trim() ? linha : "&nbsp;"}</p>`)
    .join("");
}

export type ResumoEnvio = {
  enviados: number;
  falhas: number;
  pulados: number;
};

// Envia (e loga) os e-mails de aniversário de quem faz aniversário hoje
// (fuso São Paulo), respeitando a regra em ConfigNotificacao: se desativada,
// não faz nada; `niveisAlvo` vazio = todos os níveis.
export async function enviarNotificacoesAniversarioHoje(): Promise<ResumoEnvio> {
  const resumo: ResumoEnvio = { enviados: 0, falhas: 0, pulados: 0 };

  const config = await prisma.configNotificacao.findUnique({
    where: { gatilho: "aniversario_dia" },
  });
  if (!config || !config.ativo) return resumo;

  const hoje = hojeSaoPaulo();
  const enviaPorEmail = config.canais.includes("email");

  const membros = await prisma.membro.findMany({
    where: {
      status: { not: "inativo" },
      dataNascimento: { not: null },
      ...(config.niveisAlvo.length > 0 ? { nivelAcesso: { in: config.niveisAlvo } } : {}),
    },
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      notifEmail: true,
      dataNascimento: true,
    },
  });

  const aniversariantes = membros.filter(
    (m) =>
      m.dataNascimento!.getUTCMonth() + 1 === hoje.mes &&
      m.dataNascimento!.getUTCDate() === hoje.dia,
  );

  const assuntoTpl = config.assunto || "🎂 Feliz Aniversário, {{nome}}!";
  const mensagemTpl = config.mensagem || "Olá, {{nome}}! Feliz aniversário!";

  for (const membro of aniversariantes) {
    const primeiroNome = membro.nomeCompleto.split(" ")[0];
    const dados = { nome: primeiroNome, nomeCompleto: membro.nomeCompleto };

    const registrar = (status: "enviado" | "falhou" | "pulado", detalhe: string) =>
      prisma.logNotificacao.create({
        data: {
          gatilho: "aniversario_dia",
          membroId: membro.id,
          canal: "email",
          status,
          destino: membro.email,
          detalhe,
        },
      });

    if (!enviaPorEmail) {
      resumo.pulados += 1;
      await registrar("pulado", "canal e-mail desativado na regra");
      continue;
    }
    if (!membro.notifEmail) {
      resumo.pulados += 1;
      await registrar("pulado", "membro desativou notificação por e-mail");
      continue;
    }
    if (ehEmailSintetico(membro.email)) {
      resumo.pulados += 1;
      await registrar("pulado", "e-mail sintético (não entregável)");
      continue;
    }

    const resultado = await enviarEmail({
      para: membro.email,
      assunto: preencherTemplate(assuntoTpl, dados),
      html: paraHtml(preencherTemplate(mensagemTpl, dados)),
    });

    if (resultado.ok) {
      resumo.enviados += 1;
      await registrar("enviado", resultado.id || "ok");
    } else {
      resumo.falhas += 1;
      await registrar("falhou", resultado.erro);
    }
  }

  return resumo;
}
