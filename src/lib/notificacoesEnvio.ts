import "server-only";
import { prisma } from "@/lib/prisma";
import { hojeSaoPaulo, type HojeBR } from "@/lib/aniversariantes";
import { enviarEmail, ehEmailSintetico } from "@/lib/email";
import type { GatilhoNotificacao } from "@prisma/client";

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

// ─────────────────────────────────────────────────────────────────────────
// Agendamento (rodada 2). O Vercel Cron (plano Hobby) só dispara 1x/dia num
// horário FIXO gravado em código — não dá pra deixar o painel escolher a
// hora de verdade só com isso. Em vez disso, algo externo (pg_cron do
// Supabase) chama esta checagem a cada poucos minutos, e ELA decide se já é
// a hora configurada em cada regra — com `ultimoDisparoEm` evitando mandar
// duas vezes no mesmo dia.
// ─────────────────────────────────────────────────────────────────────────

function horaAtualSaoPaulo(): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(new Date());
}

// Meia-noite de São Paulo, expressa em UTC (São Paulo é UTC−3 o ano todo,
// sem horário de verão) — usada para saber se `ultimoDisparoEm` é de hoje.
function inicioDoDiaSaoPauloUTC(hoje: HojeBR): Date {
  return new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia, 3, 0, 0));
}

// Gatilhos diários com envio implementado. `lembrete_vespera` já existe no
// painel, mas entra aqui só quando a Rodada 2 (parte 2) implementar o envio.
const ENVIADORES_DIARIOS: Partial<Record<GatilhoNotificacao, () => Promise<ResumoEnvio>>> = {
  aniversario_dia: enviarNotificacoesAniversarioHoje,
};

export type StatusChecagem = {
  gatilho: GatilhoNotificacao;
  executado: boolean;
  motivo: string;
  resumo?: ResumoEnvio;
};

// Chamada pela rota de cron a cada tick (a cada poucos minutos). Para cada
// gatilho diário implementado: pula se a regra estiver inativa, sem horário
// configurado, se ainda não chegou a hora, ou se já rodou hoje; senão,
// dispara o envio de verdade e marca `ultimoDisparoEm`.
export async function verificarEDispararGatilhosDiarios(): Promise<StatusChecagem[]> {
  const hoje = hojeSaoPaulo();
  const horaAtual = horaAtualSaoPaulo();
  const inicioHoje = inicioDoDiaSaoPauloUTC(hoje);
  const resultados: StatusChecagem[] = [];

  for (const [gatilho, enviar] of Object.entries(ENVIADORES_DIARIOS) as [
    GatilhoNotificacao,
    () => Promise<ResumoEnvio>,
  ][]) {
    const config = await prisma.configNotificacao.findUnique({ where: { gatilho } });

    if (!config || !config.ativo) {
      resultados.push({ gatilho, executado: false, motivo: "regra inativa" });
      continue;
    }
    if (!config.horarioEnvio) {
      resultados.push({ gatilho, executado: false, motivo: "horário não configurado" });
      continue;
    }
    if (horaAtual < config.horarioEnvio) {
      resultados.push({
        gatilho,
        executado: false,
        motivo: `aguardando horário (configurado ${config.horarioEnvio}, agora ${horaAtual})`,
      });
      continue;
    }
    if (config.ultimoDisparoEm && config.ultimoDisparoEm >= inicioHoje) {
      resultados.push({ gatilho, executado: false, motivo: "já executado hoje" });
      continue;
    }

    const resumo = await enviar();
    await prisma.configNotificacao.update({
      where: { gatilho },
      data: { ultimoDisparoEm: new Date() },
    });
    resultados.push({ gatilho, executado: true, motivo: "disparado", resumo });
  }

  return resultados;
}
