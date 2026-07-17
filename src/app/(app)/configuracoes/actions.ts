"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";
import { enviarNotificacoesAniversarioHoje } from "@/lib/notificacoesEnvio";
import type { NivelAcesso } from "@prisma/client";

const NIVEIS_VALIDOS: NivelAcesso[] = [
  "super_admin",
  "admin",
  "monitor",
  "lider",
  "membro",
];

// Salva uma regra de ConfigNotificacao (uma linha por gatilho). O canal
// Telegram ainda não é editável pela tela (chega na próxima rodada) — o
// valor gravado no banco é preservado tal como está, só `email` é
// alternado pelo checkbox do formulário.
export async function salvarConfigNotificacao(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("configuracoes_sistema");
  const id = String(formData.get("id") ?? "");
  const ativo = formData.get("ativo") === "on";
  const canalEmail = formData.get("canalEmail") === "on";
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

// Dispara manualmente os e-mails de aniversário de hoje — útil para validar
// a regra sem esperar o cron diário do Vercel.
export async function testarAniversarioAgora(
  _prev: EstadoAcao, // eslint-disable-line @typescript-eslint/no-unused-vars -- assinatura exigida por useActionState
  _formData: FormData, // eslint-disable-line @typescript-eslint/no-unused-vars -- idem
): Promise<EstadoAcao> {
  await requirePermissao("configuracoes_sistema");

  const resumo = await enviarNotificacoesAniversarioHoje();
  revalidatePath("/configuracoes");

  const total = resumo.enviados + resumo.falhas + resumo.pulados;
  if (total === 0) {
    return sucesso(
      "Nenhum aniversariante hoje (ou a regra está desativada) — nada foi enviado.",
    );
  }
  return sucesso(
    `Teste executado: ${resumo.enviados} enviado(s), ${resumo.falhas} falha(s), ${resumo.pulados} pulado(s). Veja o log abaixo.`,
  );
}
