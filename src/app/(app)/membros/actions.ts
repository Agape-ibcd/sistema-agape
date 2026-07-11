"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";
import { uploadFotoMembro, removerFotoMembro } from "@/lib/storage";
import { parseDataISO } from "@/lib/recorrencia";

// Estado do formulário de membro: além do popup padrão, devolve o id criado
// para o cliente redirecionar após o "Entendi".
export type EstadoMembro =
  | (NonNullable<EstadoAcao> & { membroId?: string })
  | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function revalidarMembros(id?: string) {
  revalidatePath("/membros");
  if (id) revalidatePath(`/membros/${id}`);
}

// Cria ou atualiza um membro (id presente = edição). A foto, quando enviada,
// já chega redimensionada para 300×300 pelo cliente e vai para o Storage.
export async function salvarMembro(
  _prev: EstadoMembro,
  formData: FormData,
): Promise<EstadoMembro> {
  const usuario = await requirePermissao("gerenciar_membros");

  const id = String(formData.get("id") ?? "").trim() || null;
  const nomeCompleto = String(formData.get("nomeCompleto") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const celular = String(formData.get("celular") ?? "").trim();
  const nascimentoStr = String(formData.get("dataNascimento") ?? "").trim();
  const equipeId = String(formData.get("equipeId") ?? "").trim() || null;
  const observacao = String(formData.get("observacao") ?? "").trim();
  const foto = formData.get("foto");

  if (nomeCompleto.length < 3) return falha("Informe o nome completo.");
  if (!EMAIL_RE.test(email)) return falha("Informe um e-mail válido.");
  if (celular.length > 20) return falha("O celular deve ter no máximo 20 caracteres.");

  let dataNascimento: Date | null = null;
  if (nascimentoStr) {
    dataNascimento = parseDataISO(nascimentoStr);
    if (!dataNascimento) return falha("Data de nascimento inválida.");
  }

  const dados = {
    nomeCompleto,
    email,
    celularWhatsapp: celular || null,
    dataNascimento,
    equipeId,
    observacao: observacao || null,
  };

  try {
    let membroId: string;

    if (id) {
      const antes = await prisma.membro.findUnique({ where: { id } });
      if (!antes) return falha("Membro não encontrado.");

      const depois = await prisma.membro.update({ where: { id }, data: dados });
      membroId = depois.id;

      await writeAudit({
        usuarioId: usuario.membroId,
        acao: "editar",
        tabelaAfetada: "membros",
        registroId: membroId,
        dadosAnteriores: {
          nomeCompleto: antes.nomeCompleto,
          email: antes.email,
          celularWhatsapp: antes.celularWhatsapp,
          dataNascimento: antes.dataNascimento?.toISOString() ?? null,
          equipeId: antes.equipeId,
          observacao: antes.observacao,
        },
        dadosNovos: { ...dados, dataNascimento: dataNascimento?.toISOString() ?? null },
      });
    } else {
      const criado = await prisma.membro.create({ data: dados });
      membroId = criado.id;

      await writeAudit({
        usuarioId: usuario.membroId,
        acao: "criar",
        tabelaAfetada: "membros",
        registroId: membroId,
        dadosNovos: { ...dados, dataNascimento: dataNascimento?.toISOString() ?? null },
      });
    }

    // Foto (opcional) — sobe depois de garantir o id do membro.
    if (foto instanceof File && foto.size > 0) {
      const fotoUrl = await uploadFotoMembro(membroId, foto);
      await prisma.membro.update({ where: { id: membroId }, data: { fotoUrl } });
    }

    revalidarMembros(membroId);
    return {
      ...sucesso(id ? "Membro atualizado com sucesso." : "Membro cadastrado com sucesso.")!,
      membroId,
    };
  } catch (erro) {
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2002"
    ) {
      return falha("Já existe um membro cadastrado com este e-mail.");
    }
    return falha(
      `Erro ao salvar: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Inativa ou reativa um membro — nunca há exclusão física de membros.
export async function alternarStatusMembro(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_membros");
  const id = String(formData.get("id") ?? "");

  try {
    const antes = await prisma.membro.findUnique({ where: { id } });
    if (!antes) return falha("Membro não encontrado.");

    const novoStatus = antes.status === "ativo" ? "inativo" : "ativo";
    await prisma.membro.update({ where: { id }, data: { status: novoStatus } });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: novoStatus === "inativo" ? "inativar" : "reativar",
      tabelaAfetada: "membros",
      registroId: id,
      dadosAnteriores: { status: antes.status },
      dadosNovos: { status: novoStatus },
    });

    revalidarMembros(id);
    return sucesso(
      novoStatus === "inativo"
        ? `${antes.nomeCompleto} foi inativado(a). O histórico de presenças permanece.`
        : `${antes.nomeCompleto} foi reativado(a).`,
    );
  } catch (erro) {
    return falha(
      `Erro ao alterar status: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Remove a foto do membro (Storage + referência no cadastro).
export async function removerFoto(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_membros");
  const id = String(formData.get("id") ?? "");

  try {
    const membro = await prisma.membro.findUnique({ where: { id } });
    if (!membro) return falha("Membro não encontrado.");
    if (!membro.fotoUrl) return falha("Este membro não tem foto cadastrada.");

    await removerFotoMembro(id);
    await prisma.membro.update({ where: { id }, data: { fotoUrl: null } });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "editar",
      tabelaAfetada: "membros",
      registroId: id,
      dadosAnteriores: { fotoUrl: membro.fotoUrl },
      dadosNovos: { fotoUrl: null },
    });

    revalidarMembros(id);
    return sucesso("Foto removida.");
  } catch (erro) {
    return falha(
      `Erro ao remover a foto: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}
