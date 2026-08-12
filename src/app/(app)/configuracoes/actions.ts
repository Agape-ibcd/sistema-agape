"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";
import {
  enviarNotificacoesAniversarioHoje,
  dispararNotificacaoAniversarioLideres,
  enviarDigestAniversariantesMes,
  enviarLembreteVesperaAmanha,
  verificarPresencasPendentes,
  type ResumoEnvio,
} from "@/lib/notificacoesEnvio";
import { hojeSaoPaulo } from "@/lib/aniversariantes";
import type { GatilhoNotificacao, NivelAcesso } from "@prisma/client";

const NIVEIS_VALIDOS: NivelAcesso[] = [
  "super_admin",
  "admin",
  "monitor",
  "lider",
  "membro",
];

// Salva uma regra de ConfigNotificacao (uma linha por gatilho).
export async function salvarConfigNotificacao(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("configuracoes_sistema");
  const id = String(formData.get("id") ?? "");
  const ativo = formData.get("ativo") === "on";
  const canalEmail = formData.get("canalEmail") === "on";
  const canalTelegram = formData.get("canalTelegram") === "on";
  const assunto = String(formData.get("assunto") ?? "").trim();
  const mensagem = String(formData.get("mensagem") ?? "").trim();
  const horarioEnvio = String(formData.get("horarioEnvio") ?? "").trim();
  const niveisAlvo = formData
    .getAll("niveisAlvo")
    .map(String)
    .filter((v): v is NivelAcesso => (NIVEIS_VALIDOS as string[]).includes(v));

  if (!id) return falha("Regra não encontrada.");

  try {
    const atual = await prisma.configNotificacao.findUnique({ where: { id } });
    if (!atual) return falha("Regra não encontrada.");

    const canais = new Set(atual.canais);
    if (canalEmail) canais.add("email");
    else canais.delete("email");
    if (canalTelegram) canais.add("telegram");
    else canais.delete("telegram");

    await prisma.configNotificacao.update({
      where: { id },
      data: {
        ativo,
        niveisAlvo,
        canais: Array.from(canais),
        assunto: assunto || null,
        mensagem: mensagem || null,
        horarioEnvio: horarioEnvio || null,
        atualizadoPor: usuario.membroId,
      },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "editar",
      tabelaAfetada: "config_notificacao",
      registroId: id,
      dadosAnteriores: {
        ativo: atual.ativo,
        niveisAlvo: atual.niveisAlvo,
        canais: atual.canais,
      },
      dadosNovos: { ativo, niveisAlvo, canais: Array.from(canais) },
    });

    revalidatePath("/configuracoes");
    return sucesso(`Regra "${atual.gatilho}" atualizada.`);
  } catch (erro) {
    return falha(
      `Erro ao salvar: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Gatilhos diários/em lote que fazem sentido disparar manualmente (sem
// precisar de um alvo específico como uma escala ou um evento) — os demais
// (nova_escala, escala_alterada, membro_editado_por_lider, perfil_editado)
// só disparam de verdade a partir da ação real que os originou.
const ENVIADORES_MANUAIS: Partial<Record<GatilhoNotificacao, () => Promise<ResumoEnvio>>> = {
  aniversario_dia: enviarNotificacoesAniversarioHoje,
  aniversario_lideres_dia: () => dispararNotificacaoAniversarioLideres(),
  // Força o envio do mês seguinte mesmo fora do último dia do mês (o gatilho
  // automático só dispara nessa data) — é o mesmo uso de mesOverride já
  // usado nos scripts de teste manual.
  aniversariantes_mes: () => enviarDigestAniversariantesMes((hojeSaoPaulo().mes % 12) + 1),
  lembrete_vespera: enviarLembreteVesperaAmanha,
  presenca_pendente: () => verificarPresencasPendentes(),
};

// Dispara manualmente uma regra de notificação em lote — usado pelo ícone
// "Enviar agora" de cada card em /configuracoes, com confirmação prévia no
// cliente (window.confirm). Envia de verdade para os destinatários reais
// elegíveis no momento, sem esperar o horário/cron configurado.
export async function enviarNotificacaoManual(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  await requirePermissao("configuracoes_sistema");

  const gatilho = String(formData.get("gatilho") ?? "") as GatilhoNotificacao;
  const enviar = ENVIADORES_MANUAIS[gatilho];
  if (!enviar) return falha("Envio manual não disponível para esta regra.");

  const resumo = await enviar();
  revalidatePath("/configuracoes");

  const total = resumo.enviados + resumo.falhas + resumo.pulados;
  if (total === 0) {
    return sucesso("Nada a enviar agora (sem destinatários elegíveis no momento).");
  }
  return sucesso(
    `Envio manual: ${resumo.enviados} enviado(s), ${resumo.falhas} falha(s), ${resumo.pulados} pulado(s). Veja o log abaixo.`,
  );
}
