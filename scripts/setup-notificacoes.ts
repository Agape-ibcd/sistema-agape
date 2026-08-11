import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────
// Etapa 6 — Semeia as 4 regras de ConfigNotificacao (idempotente: só cria a
// que ainda não existir, nunca sobrescreve o que o usuário já configurou
// pelo painel /configuracoes). Só `aniversario_dia` nasce ativo — os demais
// gatilhos existem para configuração antecipada, mas o disparo ainda não
// está implementado (chega numa próxima rodada).
// ─────────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

const REGRAS_PADRAO = [
  {
    gatilho: "aniversario_dia" as const,
    ativo: true,
    niveisAlvo: [],
    canais: ["email"] as const,
    assunto: "🎂 Feliz Aniversário, {{nome}}!",
    mensagem:
      "Olá, {{nome}}!\n\nToda a equipe do Ministério Ágape deseja um feliz aniversário! Que este novo ano de vida seja repleto de bênçãos.\n\nCom carinho,\nMinistério Ágape — Casa de Deus Jundiaí",
    horarioEnvio: "06:00",
  },
  {
    gatilho: "nova_escala" as const,
    ativo: false,
    niveisAlvo: [],
    canais: ["email"] as const,
    assunto: "Você foi escalado(a) — confirme sua presença",
    mensagem:
      "Olá, {{nome}}!\n\nVocê foi escalado(a) para {{evento}} em {{data}}. Por favor, confirme sua presença.\n\nMinistério Ágape",
    horarioEnvio: null,
  },
  {
    gatilho: "escala_alterada" as const,
    ativo: false,
    niveisAlvo: [],
    canais: ["email"] as const,
    assunto: "Alteração na sua escala",
    mensagem:
      "Olá, {{nome}}!\n\nHouve uma alteração na escala de {{evento}} em {{data}}. Confira os detalhes no sistema.\n\nMinistério Ágape",
    horarioEnvio: null,
  },
  {
    gatilho: "lembrete_vespera" as const,
    ativo: false,
    niveisAlvo: [],
    canais: ["email"] as const,
    assunto: "Lembrete: você está escalado(a) amanhã",
    mensagem:
      "Olá, {{nome}}!\n\nLembrando que você está escalado(a) para {{evento}} amanhã, {{data}}.\n\nMinistério Ágape",
    horarioEnvio: "18:00",
  },
  {
    // Avisa admin/super quando um líder edita um membro da própria equipe.
    gatilho: "membro_editado_por_lider" as const,
    ativo: true,
    niveisAlvo: [],
    canais: ["email", "telegram"] as const,
    assunto: "Cadastro atualizado por líder — {{membro}}",
    mensagem:
      "Olá, {{nome}}!\n\n{{editor}} atualizou o cadastro de {{membro}} (equipe {{equipe}}).\n{{detalhe}}\n\nMinistério Ágape",
    horarioEnvio: null,
  },
  {
    // Avisa líder(es) da equipe + admin/super quando alguém edita o próprio perfil.
    gatilho: "perfil_editado" as const,
    ativo: true,
    niveisAlvo: [],
    canais: ["email", "telegram"] as const,
    assunto: "Perfil atualizado — {{membro}}",
    mensagem:
      "Olá, {{nome}}!\n\n{{membro}} atualizou o próprio perfil.\n{{detalhe}}\n\nMinistério Ágape",
    horarioEnvio: null,
  },
  {
    // Avisa o(s) líder(es) da equipe quando a presença fica pendente 3h+
    // após o início do evento. Nasce INATIVO de propósito (mesma cautela do
    // incidente de teste da Etapa 6 parte 2) — ativar pelo painel quando o
    // texto for revisado.
    gatilho: "presenca_pendente" as const,
    ativo: false,
    niveisAlvo: [],
    canais: ["email", "telegram"] as const,
    assunto: "Presença pendente — {{evento}}",
    mensagem:
      "Olá, {{nome}}!\n\nJá se passaram 3h do início de {{evento}} ({{equipe}}, {{data}} às {{hora}}) e a presença ainda não foi totalmente registrada.\n\nFaltam: {{faltando}}\n\nRegistre em: {{link}}\n\nMinistério Ágape",
    horarioEnvio: null,
  },
  {
    // Avisa líder(es) da equipe + admin/super sobre aniversariante(s) do dia
    // (só dispara se houver algum) — inclui o cartão em HTML. Nasce INATIVO
    // (mesma cautela do incidente de teste da Etapa 6 parte 2).
    gatilho: "aniversario_lideres_dia" as const,
    ativo: false,
    niveisAlvo: [],
    canais: ["email"] as const,
    assunto: "Ministério Ágape: Aniversariantes do Dia.",
    mensagem:
      "Olá, {{nome}}!\n\nHoje é aniversário de:\n{{lista}}\n\nMinistério Ágape",
    horarioEnvio: "06:05",
  },
  {
    // Digest do último dia do mês: aniversariantes do mês SEGUINTE, em lista,
    // para todos os líderes + admin/super. Nasce INATIVO (mesma cautela).
    gatilho: "aniversariantes_mes" as const,
    ativo: false,
    niveisAlvo: [],
    canais: ["email"] as const,
    assunto: "Ministério Ágape: Aniversariantes do Mês de {{mes}} de {{ano}}.",
    mensagem:
      "Olá, {{nome}}!\n\nAniversariantes de {{mes}}:\n{{lista}}\n\nMinistério Ágape",
    horarioEnvio: "07:00",
  },
];

async function main() {
  for (const regra of REGRAS_PADRAO) {
    const existente = await prisma.configNotificacao.findUnique({
      where: { gatilho: regra.gatilho },
    });
    if (existente) {
      console.log(`Regra "${regra.gatilho}" já existia — mantida sem alteração.`);
      continue;
    }
    await prisma.configNotificacao.create({
      data: { ...regra, niveisAlvo: [...regra.niveisAlvo], canais: [...regra.canais] },
    });
    console.log(`Regra "${regra.gatilho}" criada (ativo=${regra.ativo}).`);
  }
  console.log("\nSetup de notificações concluído.");
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
