import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { enviarEmail, ehEmailSintetico } from "@/lib/email";
import { uploadFotoCandidatura, moverFotoCandidaturaParaMembro } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { dispararNotificacaoNovaCandidatura } from "@/lib/notificacoesEnvio";
import type { NivelAcesso, OrigemConvite } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────
// "Convite ao Ministério" — captação de novos membros. Mesmo padrão de
// token opaco + expiração de AlteracaoPerfilPendente/ConfirmacaoEscala, mas
// aplicado a DOIS registros em sequência:
//   1. ConviteMinisterio — gerado por um usuário logado (link ou e-mail),
//      reutilizável até expirar. Pedido do usuário: sempre mostra quem
//      convidou.
//   2. CandidaturaMembro — formulário público preenchido pelo convidado,
//      fica PENDENTE até Super Admin/Admin aprovar ou reprovar em
//      /solicitacoes (não existe aprovação automática).
// ─────────────────────────────────────────────────────────────────────────

export const VALIDADE_DIAS_CONVITE = 90;

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

// Mesma receita de senha provisória usada em usuarios/actions.ts (o membro
// aprovado troca no primeiro acesso, então é descartável).
function gerarSenhaProvisoria(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += alfabeto[randomInt(alfabeto.length)];
  return `Agape-${s}`;
}

// Fallback fixo: sem isso, um APP_URL ausente/vazio em produção gera links
// RELATIVOS ("/convidado/token") nos e-mails — sem domínio, a maioria dos
// clientes de e-mail (Outlook, WhatsApp) não consegue resolver e mostra o
// link quebrado/entre colchetes. Incidente reportado pelo usuário em
// 2026-08-13: o link do convite (gerarConvite) não tinha esse fallback.
function appUrl(): string {
  return (process.env.APP_URL || "https://agape.lebrai.com.br").replace(/\/$/, "");
}

// Os nomes/textos inseridos nos e-mails vêm de dados reais (nome de quem
// convidou, nome do candidato, motivo de reprovação) — escapa antes de
// colocar em HTML.
function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Assinatura padrão dos 4 e-mails do funil (texto fornecido pelo usuário em
// 2026-08-13): "Seja em Deus," + nome de quem praticou a ação (quem convidou,
// no convite; quem decidiu, na aprovação/reprovação) + "Liderança do
// Ministério Ágape".
function assinatura(nome: string): string {
  return `<p>Seja em Deus,<br/>${escapeHtml(nome)}<br/>Liderança do Ministério Ágape</p>`;
}

// Botão de destaque para a página institucional "Nosso Servir" (regras e
// orientações do Ministério) — usado no e-mail de agradecimento da
// candidatura no lugar do antigo PDF anexo.
function botaoNossoServir(): string {
  const url = `${appUrl()}/nosso-servir`;
  return `<p><a href="${url}" style="display:inline-block;background:#0c0c0c;color:#e8c766;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:700;letter-spacing:0.02em;border:1px solid #b8860b;">O MINISTÉRIO ÁGAPE DA CASA DE DEUS</a></p>`;
}

// ─────────────────────────────── Convite ───────────────────────────────

export type ResultadoConvite =
  | { ok: true; token: string; url: string }
  | { ok: false; motivo: string };

// Gera (ou reaproveita) o convite. `origem: "email"` também dispara o
// e-mail de convite para `emailConvidado`.
export async function gerarConvite(
  criadoPorId: string,
  origem: OrigemConvite,
  emailConvidado?: string,
): Promise<ResultadoConvite> {
  if (origem === "email") {
    const email = (emailConvidado ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, motivo: "Informe um e-mail válido." };
    }
  }

  const criador = await prisma.membro.findUnique({ where: { id: criadoPorId } });
  if (!criador) return { ok: false, motivo: "Usuário não encontrado." };

  const token = randomUUID().replace(/-/g, "");
  await prisma.conviteMinisterio.create({
    data: {
      token,
      criadoPorId,
      origem,
      emailConvidado: origem === "email" ? emailConvidado!.trim().toLowerCase() : null,
      expiraEm: new Date(Date.now() + VALIDADE_DIAS_CONVITE * 24 * 60 * 60 * 1000),
    },
  });

  const url = `${appUrl()}/convidado/${token}`;

  if (origem === "email") {
    const nomeConvidante = escapeHtml(criador.nomeCompleto);
    const r = await enviarEmail({
      para: emailConvidado!.trim().toLowerCase(),
      assunto: "Você foi convidado(a) para o Ministério Ágape!",
      html: [
        `<p>Olá!</p>`,
        `<p>Que alegria!</p>`,
        `<p><strong>${nomeConvidante}</strong> indicou você para fazer parte do Ministério Ágape da Igreja Batista Casa de Deus.</p>`,
        `<p>Nós somos o ministério de acolhimento da igreja, responsáveis por receber nossos irmãos e visitantes com amor, excelência e sorriso de Cristo.</p>`,
        `<p>Gostaríamos muito de ter você servindo ao Senhor conosco.</p>`,
        `<p>Para conhecer como funcionamos e preencher os seus dados, clique no link abaixo:</p>`,
        `<p><a href="${url}" style="display:inline-block;background:#059669;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;">Quero conhecer o Ministério Ágape</a></p>`,
        `<p><a href="${url}">${url}</a></p>`,
        assinatura(criador.nomeCompleto),
      ].join(""),
    });
    if (!r.ok) {
      return { ok: false, motivo: `O convite foi gerado, mas o e-mail falhou: ${r.erro}` };
    }
  }

  return { ok: true, token, url };
}

export async function buscarConvitePorToken(token: string) {
  const convite = await prisma.conviteMinisterio.findUnique({
    where: { token },
    include: { criadoPor: { select: { nomeCompleto: true } } },
  });
  if (!convite) return { valido: false as const, motivo: "Link inválido." };
  if (convite.expiraEm < new Date()) {
    return { valido: false as const, motivo: "Este link de convite expirou." };
  }
  return { valido: true as const, convite };
}

// ─────────────────────────────── Candidatura ───────────────────────────────

export type DadosCandidatura = {
  nomeCompleto: string;
  email: string;
  celularWhatsapp: string;
  dataNascimento: Date;
  membroDesde: Date; // dia 1 do mês/ano informado
  fezCursoMnv: boolean;
  mnvConclusao: Date | null;
  alunoEscolaBiblica: boolean;
  participaOutroMinisterio: boolean;
  quaisMinisterios: string | null;
};

export type ResultadoCandidatura =
  | { ok: true; candidaturaId: string }
  | { ok: false; motivo: string };

export async function criarCandidatura(
  conviteId: string,
  dados: DadosCandidatura,
  foto: File,
): Promise<ResultadoCandidatura> {
  const nome = dados.nomeCompleto.trim();
  const email = dados.email.trim().toLowerCase();
  if (nome.length < 3) return { ok: false, motivo: "Informe o nome completo." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, motivo: "E-mail inválido." };
  if (!dados.celularWhatsapp.trim()) return { ok: false, motivo: "Informe o celular/WhatsApp." };
  if (foto.size === 0) return { ok: false, motivo: "A foto é obrigatória." };

  const emailEmUso = await prisma.membro.findUnique({ where: { email } });
  if (emailEmUso) {
    return { ok: false, motivo: "Já existe um membro cadastrado com este e-mail." };
  }

  const convite = await prisma.conviteMinisterio.findUnique({
    where: { id: conviteId },
    include: { criadoPor: { select: { nomeCompleto: true } } },
  });
  if (!convite) return { ok: false, motivo: "Convite inválido." };
  if (convite.expiraEm < new Date()) return { ok: false, motivo: "Este link de convite expirou." };

  try {
    const candidatura = await prisma.candidaturaMembro.create({
      data: {
        conviteId,
        nomeCompleto: nome,
        email,
        celularWhatsapp: dados.celularWhatsapp.trim(),
        dataNascimento: dados.dataNascimento,
        fotoUrl: "", // preenchido logo abaixo, após ter o id
        membroDesde: dados.membroDesde,
        fezCursoMnv: dados.fezCursoMnv,
        mnvConclusao: dados.fezCursoMnv ? dados.mnvConclusao : null,
        alunoEscolaBiblica: dados.alunoEscolaBiblica,
        participaOutroMinisterio: dados.participaOutroMinisterio,
        quaisMinisterios: dados.participaOutroMinisterio ? dados.quaisMinisterios?.trim() || null : null,
      },
    });

    const fotoUrl = await uploadFotoCandidatura(candidatura.id, foto);
    await prisma.candidaturaMembro.update({ where: { id: candidatura.id }, data: { fotoUrl } });

    await dispararNotificacaoNovaCandidatura({
      candidatoNome: nome,
      convidadoPorNome: convite.criadoPor.nomeCompleto,
      candidaturaId: candidatura.id,
    });

    // E-mail de agradecimento com botão para a página "Nosso Servir"
    // (regras/orientações do Ministério — antes era um PDF anexo, agora é a
    // página pública /nosso-servir). Assinado por quem convidou (ainda não
    // há decisão/aprovador neste ponto).
    try {
      await enviarEmail({
        para: email,
        assunto: "Recebemos o seu interesse em servir no Ministério Ágape!",
        html: [
          `<p>Olá, ${escapeHtml(nome.split(" ")[0])}!</p>`,
          `<p>Recebemos com muita alegria o seu formulário de interesse em servir no Ministério Ágape. Louvamos a Deus pela sua disposição em dedicar seu tempo e talentos para acolher as pessoas na Casa de Deus.</p>`,
          `<p>O Líder do Ministério já recebeu os seus dados e, em breve, entrará em contato com você para conversarem.</p>`,
          `<p>Antes disso, conheça as nossas Orientações e Regras Práticas — é a base do nosso serviço:</p>`,
          botaoNossoServir(),
          `<p>Que Deus abençoe grandemente a sua vida!</p>`,
          assinatura(convite.criadoPor.nomeCompleto),
        ].join(""),
      });
    } catch (erro) {
      console.error("[candidatura] falha ao enviar e-mail de agradecimento:", erro);
    }

    return { ok: true, candidaturaId: candidatura.id };
  } catch (erro) {
    return {
      ok: false,
      motivo: `Erro ao enviar candidatura: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    };
  }
}

export async function buscarCandidaturaPorId(id: string) {
  return prisma.candidaturaMembro.findUnique({ where: { id } });
}

// ─────────────────────────────── Aprovação ───────────────────────────────

export type ResultadoDecisao = { ok: true; message: string } | { ok: false; motivo: string };

export async function aprovarCandidatura(
  candidaturaId: string,
  params: { nivelAcesso: NivelAcesso; equipeId: string | null; decididoPorId: string },
): Promise<ResultadoDecisao> {
  const candidatura = await prisma.candidaturaMembro.findUnique({ where: { id: candidaturaId } });
  if (!candidatura) return { ok: false, motivo: "Candidatura não encontrada." };
  if (candidatura.status !== "pendente") return { ok: false, motivo: "Esta candidatura já foi decidida." };
  if (params.nivelAcesso === "monitor" && params.equipeId) {
    return { ok: false, motivo: "Monitores não participam de equipes — deixe a Equipe como “Sem equipe”." };
  }

  const emailEmUso = await prisma.membro.findUnique({ where: { email: candidatura.email } });
  if (emailEmUso) {
    return { ok: false, motivo: "Já existe um membro cadastrado com este e-mail — a candidatura não pode ser aprovada." };
  }

  try {
    const membroCriado = await prisma.membro.create({
      data: {
        nomeCompleto: candidatura.nomeCompleto,
        email: candidatura.email,
        celularWhatsapp: candidatura.celularWhatsapp,
        dataNascimento: candidatura.dataNascimento,
        equipeId: params.equipeId,
        nivelAcesso: params.nivelAcesso,
        observacao: [
          `Ingressou via Convite ao Ministério — membro da Igreja desde ${candidatura.membroDesde.toLocaleDateString("pt-BR", { timeZone: "UTC" })}.`,
          candidatura.fezCursoMnv
            ? `Concluiu o curso MNV${candidatura.mnvConclusao ? ` em ${candidatura.mnvConclusao.toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : ""}.`
            : "Ainda não fez o curso MNV.",
          candidatura.alunoEscolaBiblica ? "Aluno da Escola Bíblica Casa de Deus." : "Não é aluno da Escola Bíblica Casa de Deus.",
          candidatura.participaOutroMinisterio
            ? `Participa de outro(s) ministério(s): ${candidatura.quaisMinisterios ?? "—"}.`
            : "Não participa de outro ministério.",
        ].join(" "),
      },
    });

    const fotoUrl = await moverFotoCandidaturaParaMembro(candidatura.id, membroCriado.id);
    await prisma.membro.update({ where: { id: membroCriado.id }, data: { fotoUrl } });

    const senha = gerarSenhaProvisoria();
    const { data, error } = await authAdmin().createUser({
      email: membroCriado.email,
      password: senha,
      email_confirm: true,
    });
    if (error) return { ok: false, motivo: `Membro criado, mas o Supabase Auth falhou: ${error.message}` };
    await prisma.membro.update({
      where: { id: membroCriado.id },
      data: { authUserId: data.user.id, deveTrocarSenha: true },
    });

    await prisma.candidaturaMembro.update({
      where: { id: candidaturaId },
      data: {
        status: "aprovado",
        decididoPorId: params.decididoPorId,
        decididoEm: new Date(),
        equipeIdDefinida: params.equipeId,
        nivelAcessoDefinido: params.nivelAcesso,
        membroCriadoId: membroCriado.id,
      },
    });

    await writeAudit({
      usuarioId: params.decididoPorId,
      acao: "aprovar_candidatura",
      tabelaAfetada: "membros",
      registroId: membroCriado.id,
      dadosNovos: { candidaturaId, email: membroCriado.email, nivelAcesso: params.nivelAcesso, equipeId: params.equipeId },
    });

    const decisor = await prisma.membro.findUnique({ where: { id: params.decididoPorId }, select: { nomeCompleto: true } });
    await enviarEmailBoasVindas({
      email: membroCriado.email,
      nome: membroCriado.nomeCompleto,
      senha,
      equipeId: params.equipeId,
      decididoPorNome: decisor?.nomeCompleto ?? "Liderança do Ministério Ágape",
    });

    return { ok: true, message: `${membroCriado.nomeCompleto} aprovado(a) e cadastrado(a) como membro.` };
  } catch (erro) {
    return {
      ok: false,
      motivo: `Erro ao aprovar candidatura: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    };
  }
}

export async function reprovarCandidatura(
  candidaturaId: string,
  params: { motivo: string; decididoPorId: string },
): Promise<ResultadoDecisao> {
  const candidatura = await prisma.candidaturaMembro.findUnique({ where: { id: candidaturaId } });
  if (!candidatura) return { ok: false, motivo: "Candidatura não encontrada." };
  if (candidatura.status !== "pendente") return { ok: false, motivo: "Esta candidatura já foi decidida." };

  try {
    await prisma.candidaturaMembro.update({
      where: { id: candidaturaId },
      data: {
        status: "reprovado",
        decididoPorId: params.decididoPorId,
        decididoEm: new Date(),
        motivoReprovacao: params.motivo.trim() || null,
      },
    });

    await writeAudit({
      usuarioId: params.decididoPorId,
      acao: "reprovar_candidatura",
      tabelaAfetada: "candidatura_membro",
      registroId: candidaturaId,
      dadosNovos: { motivo: params.motivo },
    });

    if (!ehEmailSintetico(candidatura.email)) {
      const decisor = await prisma.membro.findUnique({ where: { id: params.decididoPorId }, select: { nomeCompleto: true } });
      await enviarEmail({
        para: candidatura.email,
        assunto: "Atualização sobre o seu processo no Ministério Ágape",
        html: [
          `<p>Olá, ${escapeHtml(candidatura.nomeCompleto.split(" ")[0])}.</p>`,
          `<p>Agradecemos de coração a sua disposição e o seu desejo de servir ao Senhor no Ministério Ágape. Valorizamos muito a sua vida e a sua vontade de contribuir com a Casa de Deus.</p>`,
          `<p>Neste momento, nosso Líder do Ministério entrará em contato com você pessoalmente para conversarem, orarem juntos e avaliarem os próximos passos da sua caminhada no serviço cristão.</p>`,
          params.motivo.trim() ? `<p>${escapeHtml(params.motivo.trim())}</p>` : "",
          `<p>Deus tem um propósito lindo para a sua vida e queremos caminhar ao seu lado para que você sirva com alegria e excelência na casa do Senhor.</p>`,
          assinatura(decisor?.nomeCompleto ?? "Liderança do Ministério Ágape"),
        ].join(""),
      });
    }

    return { ok: true, message: `Candidatura de ${candidatura.nomeCompleto} reprovada.` };
  } catch (erro) {
    return {
      ok: false,
      motivo: `Erro ao reprovar candidatura: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    };
  }
}

// E-mail de boas-vindas (texto fornecido pelo usuário em 2026-08-13, em
// e-mails_padrao.docx) + bloco técnico de credenciais (login/senha
// provisória — sem isso o membro não consegue entrar no sistema) e, quando
// há equipe definida, a primeira escala com traje (roupa social preta,
// conforme o PDF de regras) e chegada 1h15 antes (convenção fixa do sistema:
// horarioChegadaEquipe = horarioInicio − 1h15, ver schema.prisma).
async function enviarEmailBoasVindas(params: {
  email: string;
  nome: string;
  senha: string;
  equipeId: string | null;
  decididoPorNome: string;
}): Promise<void> {
  const primeiroNome = escapeHtml(params.nome.split(" ")[0]);
  const url = appUrl();

  const blocos = [
    `<p>Olá, ${primeiroNome}!</p>`,
    `<p>É com o coração cheio de gratidão que recebemos você oficialmente no Ministério Ágape.</p>`,
    `<p>Romanos 15:7 nos ensina a aceitar uns aos outros como Cristo nos aceitou, e agora você é parte dessa missão na prática!</p>`,
    `<p>Seus dados de acesso ao sistema do ministério já foram criados:</p>`,
    `<p>Endereço: <a href="${url}">${url}</a><br/>Login (e-mail): ${escapeHtml(params.email)}<br/>Senha provisória: ${escapeHtml(params.senha)}</p>`,
    `<p>No primeiro acesso o sistema vai pedir que você defina uma nova senha pessoal.</p>`,
  ];

  if (params.equipeId) {
    const equipe = await prisma.equipe.findUnique({ where: { id: params.equipeId }, select: { nome: true } });
    const proximaEscala = await prisma.escalaEquipeEvento.findFirst({
      where: { equipeId: params.equipeId, evento: { status: "agendado", dataEvento: { gte: new Date() } } },
      include: { evento: { include: { tipoEvento: { select: { nome: true } } } } },
      orderBy: { evento: { dataEvento: "asc" } },
    });

    blocos.push(
      `<p>Você foi designado(a) para atuar conosco na seguinte equipe:</p>`,
      `<p>Equipe: <strong>${escapeHtml(equipe?.nome ?? "—")}</strong></p>`,
    );

    if (proximaEscala) {
      const dataBR = proximaEscala.evento.dataEvento.toLocaleDateString("pt-BR", { timeZone: "UTC" });
      blocos.push(
        `<p>Primeira Escala: ${dataBR} às ${proximaEscala.evento.horarioInicio}</p>`,
        `<p>Lembrete importante: Chegamos sempre 1 hora e 15 minutos antes do culto para o nosso tempo de oração, alinhamento e preparo do café. Traje: roupa social preta.</p>`,
      );
    }

    blocos.push(`<p>Em breve, você será adicionado(a) ao grupo de WhatsApp da sua equipe para receber todas as informações.</p>`);
  }

  blocos.push(
    `<p>O seu Líder de Equipe está à disposição para te ajudar em tudo o que for preciso.</p>`,
    `<p>Seja muito bem-vindo(a)!</p>`,
    assinatura(params.decididoPorNome),
  );

  await enviarEmail({
    para: params.email,
    assunto: "Bem-vindo(a) ao Ministério Ágape! 🎉",
    html: blocos.join(""),
  });
}
