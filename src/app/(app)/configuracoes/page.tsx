import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { RegraNotificacaoForm, type RegraDados } from "./RegraNotificacaoForm";
import { TestarAniversarioBotao } from "./TestarAniversarioBotao";
import type { GatilhoNotificacao } from "@prisma/client";

const ORDEM: GatilhoNotificacao[] = [
  "aniversario_dia",
  "nova_escala",
  "escala_alterada",
  "lembrete_vespera",
  "membro_editado_por_lider",
  "perfil_editado",
  "presenca_pendente",
  "aniversario_lideres_dia",
  "aniversariantes_mes",
];

const META: Record<
  GatilhoNotificacao,
  {
    titulo: string;
    descricao: string;
    implementado: boolean;
    usaHorario: boolean;
    usaNiveisAlvo: boolean;
    // Texto do aviso de destinatários quando usaNiveisAlvo=false (o padrão fala
    // em "membros escalados"; gatilhos de edição têm destinatários próprios).
    avisoDestinatarios?: string;
  }
> = {
  aniversario_dia: {
    titulo: "Aniversário do dia",
    descricao: "Mensagem de felicitação enviada no dia do aniversário do membro.",
    implementado: true,
    usaHorario: true,
    usaNiveisAlvo: true,
  },
  nova_escala: {
    titulo: "Nova escala — confirmação de presença",
    descricao:
      "Avisa o membro ao ser escalado (manualmente — o rodízio em lote não dispara aqui) e pede confirmação de presença por um link.",
    implementado: true,
    usaHorario: false,
    usaNiveisAlvo: false,
  },
  escala_alterada: {
    titulo: "Escala ou evento alterado",
    descricao: "Avisa quando uma escala é trocada, removida, ou um evento é cancelado/reativado/tem o horário alterado.",
    implementado: true,
    usaHorario: false,
    usaNiveisAlvo: false,
  },
  lembrete_vespera: {
    titulo: "Lembrete véspera (D-1)",
    descricao:
      "Lembrete enviado na véspera para quem está escalado no dia seguinte (um resumo por pessoa, mesmo com vários compromissos).",
    implementado: true,
    usaHorario: true,
    usaNiveisAlvo: false,
  },
  membro_editado_por_lider: {
    titulo: "Líder editou um membro da equipe",
    descricao:
      "Avisa os administradores quando um líder altera o cadastro de um membro da própria equipe. Placeholders: {{membro}}, {{editor}}, {{equipe}}, {{detalhe}}.",
    implementado: true,
    usaHorario: false,
    usaNiveisAlvo: false,
    avisoDestinatarios: "Enviado automaticamente a todos os Administradores e Super Administradores.",
  },
  perfil_editado: {
    titulo: "Membro editou o próprio perfil",
    descricao:
      "Avisa o(s) líder(es) da equipe e os administradores quando alguém altera o próprio perfil. Placeholders: {{membro}}, {{detalhe}}.",
    implementado: true,
    usaHorario: false,
    usaNiveisAlvo: false,
    avisoDestinatarios:
      "Enviado automaticamente aos líderes da equipe da pessoa + Administradores e Super Administradores.",
  },
  presenca_pendente: {
    titulo: "Presença pendente",
    descricao:
      "Avisa o líder quando, 3h após o início do evento, a presença da equipe ainda não foi totalmente registrada — repete a cada 24h, até 5 vezes.",
    implementado: true,
    usaHorario: false,
    usaNiveisAlvo: false,
    avisoDestinatarios:
      "Enviado automaticamente ao(s) líder(es) da equipe escalada (ou a Administradores/Super Administradores, se a equipe não tiver líder ativo).",
  },
  aniversario_lideres_dia: {
    titulo: "Aniversariante do dia — aviso ao líder",
    descricao:
      "Avisa o(s) líder(es) da equipe do aniversariante + Administradores/Super, com o cartão de aniversário. Só dispara se houver aniversariante hoje.",
    implementado: true,
    usaHorario: true,
    usaNiveisAlvo: false,
    avisoDestinatarios:
      "Enviado automaticamente ao(s) líder(es) da equipe de cada aniversariante + Administradores e Super Administradores.",
  },
  aniversariantes_mes: {
    titulo: "Aniversariantes do mês seguinte",
    descricao:
      "No último dia do mês, envia a lista de aniversariantes do mês seguinte para todos os líderes e administradores.",
    implementado: true,
    usaHorario: true,
    usaNiveisAlvo: false,
    avisoDestinatarios:
      "Enviado automaticamente a todos os Líderes + Administradores e Super Administradores.",
  },
};

const ROTULO_STATUS: Record<string, string> = {
  enviado: "Enviado",
  falhou: "Falhou",
  pulado: "Pulado",
};

export default async function ConfiguracoesPage() {
  await requirePermissao("configuracoes_sistema");

  const regras = await prisma.configNotificacao.findMany();
  const porGatilho = new Map(regras.map((r) => [r.gatilho, r]));

  const logs = await prisma.logNotificacao.findMany({
    orderBy: { criadoEm: "desc" },
    take: 20,
    include: { membro: { select: { nomeCompleto: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-semibold uppercase tracking-wide text-ink">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Notificações automáticas por e-mail e Telegram.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge-soft bg-surface-2 p-4">
        <p className="text-sm text-ink-soft">
          <strong>Aniversário do dia</strong> e <strong>Lembrete véspera</strong>{" "}
          rodam sozinhos no horário configurado abaixo. Use o botão para testar
          o aniversário sem esperar a execução automática — os gatilhos de
          escala disparam na hora, direto na tela de Eventos.
        </p>
        <TestarAniversarioBotao />
      </div>

      <div className="space-y-5">
        {ORDEM.map((gatilho) => {
          const regra = porGatilho.get(gatilho);
          if (!regra) return null;
          const meta = META[gatilho];
          const dados: RegraDados = {
            id: regra.id,
            titulo: meta.titulo,
            descricao: meta.descricao,
            implementado: meta.implementado,
            ativo: regra.ativo,
            niveisAlvo: regra.niveisAlvo,
            canais: regra.canais,
            assunto: regra.assunto,
            mensagem: regra.mensagem,
            horarioEnvio: regra.horarioEnvio,
            usaHorario: meta.usaHorario,
            usaNiveisAlvo: meta.usaNiveisAlvo,
            avisoDestinatarios: meta.avisoDestinatarios,
          };
          return <RegraNotificacaoForm key={regra.id} regra={dados} />;
        })}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-ink">Últimos envios</h2>
        {logs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-edge p-6 text-center text-sm text-ink-subtle">
            Nenhum envio registrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-edge-soft vidro-leve">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-xs uppercase text-ink-subtle">
                <tr>
                  <th className="px-4 py-2">Quando</th>
                  <th className="px-4 py-2">Membro</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge-soft">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-ink-soft">
                      {log.criadoEm.toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2 text-ink">{log.membro.nomeCompleto}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          log.status === "enviado"
                            ? "text-success-text"
                            : log.status === "falhou"
                              ? "text-danger-text"
                              : "text-ink-subtle"
                        }
                      >
                        {ROTULO_STATUS[log.status] ?? log.status}
                      </span>
                    </td>
                    <td
                      className="max-w-xs truncate px-4 py-2 text-ink-subtle"
                      title={log.detalhe ?? ""}
                    >
                      {log.detalhe ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
