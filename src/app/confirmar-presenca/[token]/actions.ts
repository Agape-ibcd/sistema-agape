"use server";

import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";

// Página PÚBLICA (sem login) — a segurança é o token opaco com expiração,
// não uma sessão. Nunca confiar em nada além do token vindo do formulário.
export async function responderConfirmacaoEscala(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const token = String(formData.get("token") ?? "");
  const resposta = String(formData.get("resposta") ?? "");
  if (resposta !== "confirmado" && resposta !== "recusado") {
    return falha("Resposta inválida.");
  }

  try {
    const confirmacao = await prisma.confirmacaoEscala.findUnique({ where: { token } });
    if (!confirmacao) return falha("Link inválido.");
    if (confirmacao.expiraEm < new Date()) return falha("Este link expirou.");
    if (confirmacao.status !== "pendente") {
      return sucesso("Sua resposta já havia sido registrada anteriormente.");
    }

    await prisma.confirmacaoEscala.update({
      where: { token },
      data: { status: resposta, respondidoEm: new Date() },
    });

    await writeAudit({
      acao: resposta === "confirmado" ? "confirmar_presenca" : "recusar_presenca",
      tabelaAfetada: "confirmacao_escala",
      registroId: confirmacao.id,
    });

    return sucesso(
      resposta === "confirmado"
        ? "Presença confirmada. Obrigado por avisar!"
        : "Registrado — obrigado por avisar. Fale com a liderança da sua equipe.",
    );
  } catch (erro) {
    return falha(
      `Erro ao registrar sua resposta: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}
