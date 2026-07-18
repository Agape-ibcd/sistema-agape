import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hojeSaoPaulo, type HojeBR } from "@/lib/aniversariantes";
import { enviarEmail, ehEmailSintetico } from "@/lib/email";
import { enviarTelegram } from "@/lib/telegram";
import type { GatilhoNotificacao, CanalNotificacao, StatusEnvio } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────
// Motor de disparo (Etapa 6). `aniversario_dia`, `nova_escala`,
// `escala_alterada` e `lembrete_vespera` enviam por e-mail e Telegram —
// `enviarParaMembro` decide, por membro, quais canais tentar (interseção da
// regra em ConfigNotificacao com a preferência/vínculo do próprio membro).
// `nova_escala`/`escala_alterada` são disparados direto nos pontos de ação
// (eventos/actions.ts, aplicarRodizio.ts não dispara — ver decisão abaixo);
// os demais entram no motor diário (`verificarEDispararGatilhosDiarios`).
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

function somarResumo(a: ResumoEnvio, b: ResumoEnvio): ResumoEnvio {
  return {
    enviados: a.enviados + b.enviados,
    falhas: a.falhas + b.falhas,
    pulados: a.pulados + b.pulados,
  };
}

const SELECT_MEMBRO_DESTINO = {
  id: true,
  nomeCompleto: true,
  email: true,
  notifEmail: true,
  notifTelegram: true,
  telegramChatId: true,
} as const;

type MembroDestino = {
  id: string;
  nomeCompleto: string;
  email: string;
  notifEmail: boolean;
  notifTelegram: boolean;
  telegramChatId: string | null;
};

// Envia para UM membro pelos canais habilitados na regra E preferidos pelo
// membro (notifEmail/notifTelegram + Telegram vinculado); grava um
// LogNotificacao por canal tentado, mesmo quando pulado (trilha completa).
async function enviarParaMembro(params: {
  gatilho: GatilhoNotificacao;
  membro: MembroDestino;
  canaisRegra: CanalNotificacao[];
  assunto: string; // só usado no e-mail
  mensagem: string; // texto puro, já com placeholders resolvidos
  referenciaId?: string;
}): Promise<ResumoEnvio> {
  const resumo: ResumoEnvio = { enviados: 0, falhas: 0, pulados: 0 };
  const { gatilho, membro, canaisRegra, assunto, mensagem, referenciaId } = params;

  const registrar = (canal: CanalNotificacao, status: StatusEnvio, destino: string, detalhe: string) =>
    prisma.logNotificacao.create({
      data: { gatilho, membroId: membro.id, canal, status, destino, detalhe, referenciaId },
    });

  if (canaisRegra.includes("email")) {
    if (!membro.notifEmail) {
      resumo.pulados += 1;
      await registrar("email", "pulado", membro.email, "membro desativou notificação por e-mail");
    } else if (ehEmailSintetico(membro.email)) {
      resumo.pulados += 1;
      await registrar("email", "pulado", membro.email, "e-mail sintético (não entregável)");
    } else {
      const r = await enviarEmail({ para: membro.email, assunto, html: paraHtml(mensagem) });
      if (r.ok) {
        resumo.enviados += 1;
        await registrar("email", "enviado", membro.email, r.id || "ok");
      } else {
        resumo.falhas += 1;
        await registrar("email", "falhou", membro.email, r.erro);
      }
    }
  }

  if (canaisRegra.includes("telegram")) {
    if (!membro.notifTelegram || !membro.telegramChatId) {
      resumo.pulados += 1;
      await registrar(
        "telegram",
        "pulado",
        membro.telegramChatId ?? "—",
        "Telegram não vinculado ou desativado pelo membro",
      );
    } else {
      const r = await enviarTelegram({ chatId: membro.telegramChatId, texto: mensagem });
      if (r.ok) {
        resumo.enviados += 1;
        await registrar("telegram", "enviado", membro.telegramChatId, "ok");
      } else {
        resumo.falhas += 1;
        await registrar("telegram", "falhou", membro.telegramChatId, r.erro);
      }
    }
  }

  return resumo;
}

// Textos padrão usados quando a regra não tem assunto/mensagem customizados
// no painel /configuracoes.
const TEMPLATE_PADRAO: Record<
  Exclude<GatilhoNotificacao, "aniversario_dia">,
  { assunto: string; mensagem: string }
> = {
  nova_escala: {
    assunto: "Você foi escalado(a) — {{evento}}",
    mensagem:
      "Olá, {{nome}}! Você foi escalado(a) na equipe {{equipe}} para {{evento}}, dia {{data}} às {{hora}}.\nConfirme sua presença: {{link}}",
  },
  escala_alterada: {
    assunto: "Alteração na sua escala — {{evento}}",
    mensagem:
      "Olá, {{nome}}! {{detalhe}}\nEvento: {{evento}}, dia {{data}} às {{hora}}.",
  },
  lembrete_vespera: {
    assunto: "Lembrete: você está escalado(a) amanhã",
    mensagem: "Olá, {{nome}}! Lembrete: amanhã ({{data}}) você está escalado(a) em:\n{{lista}}",
  },
};

// Envia (e loga) os e-mails/Telegram de aniversário de quem faz aniversário
// hoje (fuso São Paulo), respeitando a regra em ConfigNotificacao: se
// desativada, não faz nada; `niveisAlvo` vazio = todos os níveis.
export async function enviarNotificacoesAniversarioHoje(): Promise<ResumoEnvio> {
  let resumo: ResumoEnvio = { enviados: 0, falhas: 0, pulados: 0 };

  const config = await prisma.configNotificacao.findUnique({
    where: { gatilho: "aniversario_dia" },
  });
  if (!config || !config.ativo || config.canais.length === 0) return resumo;

  const hoje = hojeSaoPaulo();

  const membros = await prisma.membro.findMany({
    where: {
      status: { not: "inativo" },
      dataNascimento: { not: null },
      ...(config.niveisAlvo.length > 0 ? { nivelAcesso: { in: config.niveisAlvo } } : {}),
    },
    select: { ...SELECT_MEMBRO_DESTINO, dataNascimento: true },
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

    const r = await enviarParaMembro({
      gatilho: "aniversario_dia",
      membro,
      canaisRegra: config.canais,
      assunto: preencherTemplate(assuntoTpl, dados),
      mensagem: preencherTemplate(mensagemTpl, dados),
    });
    resumo = somarResumo(resumo, r);
  }

  return resumo;
}

// ─────────────────────────────────────────────────────────────────────────
// Gatilhos por evento (nova_escala, escala_alterada) — chamados direto dos
// pontos de ação (src/app/(app)/eventos/actions.ts), não pelo motor diário.
// Nunca lançam erro: uma falha de notificação não pode derrubar a ação
// principal de escalar/alterar (mesmo padrão de writeAudit).
//
// DECISÃO: o motor de rodízio (src/lib/aplicarRodizio.ts) cria escalas EM
// LOTE (até ~50 de uma vez, janela de 3 meses) — NÃO dispara nova_escala por
// escala individual (seria spam). Quem é escalado por rodízio fica sabendo
// pelo digest da véspera (lembrete_vespera), que só olha o dia seguinte e
// portanto nunca é lote. Só escalas de origem MANUAL notificam aqui.
// ─────────────────────────────────────────────────────────────────────────

// Dispara "nova escala" para todos os membros ativos da equipe recém-
// escalada, gerando uma ConfirmacaoEscala (token opaco, expira no fim do dia
// do evento) por membro. `niveisAlvo` da regra é IGNORADO de propósito aqui
// (decisão do usuário): quem foi escalado precisa saber, não importa o nível.
export async function dispararNotificacaoNovaEscala(escalaId: string): Promise<void> {
  try {
    const config = await prisma.configNotificacao.findUnique({ where: { gatilho: "nova_escala" } });
    if (!config || !config.ativo || config.canais.length === 0) return;

    const escala = await prisma.escalaEquipeEvento.findUnique({
      where: { id: escalaId },
      include: {
        equipe: {
          select: {
            nome: true,
            membros: { where: { status: "ativo" }, select: SELECT_MEMBRO_DESTINO },
          },
        },
        evento: { include: { tipoEvento: { select: { nome: true } } } },
      },
    });
    if (!escala || escala.evento.status === "cancelado") return;
    if (escala.equipe.membros.length === 0) return;

    const dataBR = escala.evento.dataEvento.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    const nomeEvento = escala.evento.descricaoEspecifica ?? escala.evento.tipoEvento.nome;
    const expiraEm = new Date(escala.evento.dataEvento.getTime() + 24 * 60 * 60 * 1000);
    const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");

    const tpl = TEMPLATE_PADRAO.nova_escala;
    const assuntoBase = config.assunto || tpl.assunto;
    const mensagemBase = config.mensagem || tpl.mensagem;

    for (const membro of escala.equipe.membros) {
      const token = randomUUID().replace(/-/g, "");
      await prisma.confirmacaoEscala.create({
        data: { token, escalaId: escala.id, membroId: membro.id, expiraEm },
      });

      const dados = {
        nome: membro.nomeCompleto.split(" ")[0],
        equipe: escala.equipe.nome,
        evento: nomeEvento,
        data: dataBR,
        hora: escala.evento.horarioInicio,
        link: `${appUrl}/confirmar-presenca/${token}`,
      };

      await enviarParaMembro({
        gatilho: "nova_escala",
        membro,
        canaisRegra: config.canais,
        assunto: preencherTemplate(assuntoBase, dados),
        mensagem: preencherTemplate(mensagemBase, dados),
        referenciaId: escala.id,
      });
    }
  } catch (erro) {
    console.error("[notificacoes] falha ao disparar nova_escala:", erro);
  }
}

// Dispara "escala/evento alterado" para os membros ativos das equipes
// informadas (ex.: equipe removida de um evento, evento cancelado, horário
// mudou). `detalhe` é um texto curto já pronto (ex.: "Você foi removido(a)
// desta escala.", "O evento foi cancelado.").
export async function dispararNotificacaoEscalaAlterada(params: {
  eventoId: string;
  equipeIds: string[];
  detalhe: string;
}): Promise<void> {
  try {
    if (params.equipeIds.length === 0) return;

    const config = await prisma.configNotificacao.findUnique({ where: { gatilho: "escala_alterada" } });
    if (!config || !config.ativo || config.canais.length === 0) return;

    const evento = await prisma.evento.findUnique({
      where: { id: params.eventoId },
      include: { tipoEvento: { select: { nome: true } } },
    });
    if (!evento) return;

    const equipes = await prisma.equipe.findMany({
      where: { id: { in: params.equipeIds } },
      select: {
        membros: { where: { status: "ativo" }, select: SELECT_MEMBRO_DESTINO },
      },
    });

    const dataBR = evento.dataEvento.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    const nomeEvento = evento.descricaoEspecifica ?? evento.tipoEvento.nome;
    const tpl = TEMPLATE_PADRAO.escala_alterada;
    const assuntoBase = config.assunto || tpl.assunto;
    const mensagemBase = config.mensagem || tpl.mensagem;

    const vistos = new Set<string>();
    for (const equipe of equipes) {
      for (const membro of equipe.membros) {
        if (vistos.has(membro.id)) continue;
        vistos.add(membro.id);

        const dados = {
          nome: membro.nomeCompleto.split(" ")[0],
          evento: nomeEvento,
          data: dataBR,
          hora: evento.horarioInicio,
          detalhe: params.detalhe,
        };

        await enviarParaMembro({
          gatilho: "escala_alterada",
          membro,
          canaisRegra: config.canais,
          assunto: preencherTemplate(assuntoBase, dados),
          mensagem: preencherTemplate(mensagemBase, dados),
          referenciaId: params.eventoId,
        });
      }
    }
  } catch (erro) {
    console.error("[notificacoes] falha ao disparar escala_alterada:", erro);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Agendamento (motor diário). O Vercel Cron (plano Hobby) só dispara 1x/dia
// num horário FIXO gravado em código — não dá pra deixar o painel escolher a
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

// Digest da véspera (D-1): para cada membro ativo escalado em algum evento
// AGENDADO de amanhã, uma única mensagem listando todos os compromissos do
// dia seguinte — nunca é "lote" porque só olha um dia à frente, cobrindo
// naturalmente o caso do rodízio (que não dispara nova_escala por escala).
async function enviarLembreteVesperaAmanha(): Promise<ResumoEnvio> {
  let resumo: ResumoEnvio = { enviados: 0, falhas: 0, pulados: 0 };

  const config = await prisma.configNotificacao.findUnique({ where: { gatilho: "lembrete_vespera" } });
  if (!config || !config.ativo || config.canais.length === 0) return resumo;

  const hoje = hojeSaoPaulo();
  const amanha = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + 1));
  const depoisDeAmanha = new Date(amanha.getTime() + 24 * 60 * 60 * 1000);

  const eventos = await prisma.evento.findMany({
    where: { dataEvento: { gte: amanha, lt: depoisDeAmanha }, status: "agendado" },
    include: {
      tipoEvento: { select: { nome: true } },
      escalas: {
        include: {
          equipe: {
            select: { nome: true, membros: { where: { status: "ativo" }, select: SELECT_MEMBRO_DESTINO } },
          },
        },
      },
    },
    orderBy: { horarioInicio: "asc" },
  });
  if (eventos.length === 0) return resumo;

  const porMembro = new Map<string, { membro: MembroDestino; itens: string[] }>();
  for (const evento of eventos) {
    const nomeEvento = evento.descricaoEspecifica ?? evento.tipoEvento.nome;
    for (const escala of evento.escalas) {
      const item = `• ${nomeEvento} às ${evento.horarioInicio} (equipe ${escala.equipe.nome})`;
      for (const membro of escala.equipe.membros) {
        const atual = porMembro.get(membro.id);
        if (atual) atual.itens.push(item);
        else porMembro.set(membro.id, { membro, itens: [item] });
      }
    }
  }

  const dataBR = amanha.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  const tpl = TEMPLATE_PADRAO.lembrete_vespera;
  const assuntoBase = config.assunto || tpl.assunto;
  const mensagemBase = config.mensagem || tpl.mensagem;

  for (const { membro, itens } of porMembro.values()) {
    const dados = {
      nome: membro.nomeCompleto.split(" ")[0],
      data: dataBR,
      lista: itens.join("\n"),
    };
    const r = await enviarParaMembro({
      gatilho: "lembrete_vespera",
      membro,
      canaisRegra: config.canais,
      assunto: preencherTemplate(assuntoBase, dados),
      mensagem: preencherTemplate(mensagemBase, dados),
      referenciaId: `vespera:${dataBR}`,
    });
    resumo = somarResumo(resumo, r);
  }

  return resumo;
}

const ENVIADORES_DIARIOS: Partial<Record<GatilhoNotificacao, () => Promise<ResumoEnvio>>> = {
  aniversario_dia: enviarNotificacoesAniversarioHoje,
  lembrete_vespera: enviarLembreteVesperaAmanha,
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
