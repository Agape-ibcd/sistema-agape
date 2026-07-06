"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";

// Atualiza os dados editáveis do próprio perfil. Serve também como a "gravação
// de teste" da Etapa 1: escreve no banco, registra auditoria e retorna a
// resposta do servidor para o popup de confirmação.
export async function atualizarPerfil(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requireUsuario();

  const celular = String(formData.get("celular") ?? "").trim();
  const observacao = String(formData.get("observacao") ?? "").trim();

  if (celular.length > 20) {
    return falha("O celular deve ter no máximo 20 caracteres.");
  }

  try {
    const antes = await prisma.membro.findUnique({
      where: { id: usuario.membroId },
      select: { celularWhatsapp: true, observacao: true },
    });

    const depois = await prisma.membro.update({
      where: { id: usuario.membroId },
      data: {
        celularWhatsapp: celular || null,
        observacao: observacao || null,
      },
      select: { celularWhatsapp: true, observacao: true },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "editar",
      tabelaAfetada: "membros",
      registroId: usuario.membroId,
      dadosAnteriores: antes ?? undefined,
      dadosNovos: depois,
    });

    revalidatePath("/perfil");
    return sucesso("Perfil atualizado com sucesso.");
  } catch (erro) {
    return falha(
      `Erro ao salvar: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}
