"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type StatusMembro } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermissao, requireUsuario } from "@/lib/auth";
import { acessoMembros, podeEditarMembroAlvo } from "@/lib/acessoMembros";
import { writeAudit } from "@/lib/audit";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";
import { uploadFotoMembro, removerFotoMembro } from "@/lib/storage";
import { aplicarStatusMembro } from "@/lib/statusMembro";
import { dispararNotificacaoMembroEditadoPorLider } from "@/lib/notificacoesEnvio";
import { parseDataISO } from "@/lib/recorrencia";

// Estado do formulário de membro: além do popup padrão, devolve o id criado
// para o cliente redirecionar após o "Entendi".
export type EstadoMembro =
  | (NonNullable<EstadoAcao> & { membroId?: string })
  | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function revalidarMembros(id?: string) {
  revalidatePath("/membros");
  revalidatePath("/usuarios"); // a lista de acessos exibe status/equipe
  if (id) revalidatePath(`/membros/${id}`);
}

// Descreve em texto curto quais campos de perfil mudaram (para os alertas).
function descreverMudancas(
  antes: {
    nomeCompleto: string;
    celularWhatsapp: string | null;
    dataNascimento: Date | null;
    observacao: string | null;
  },
  depois: {
    nomeCompleto: string;
    celularWhatsapp: string | null;
    dataNascimento: Date | null;
    observacao: string | null;
  },
): string {
  const mudou: string[] = [];
  if (antes.nomeCompleto !== depois.nomeCompleto) mudou.push("nome");
  if ((antes.celularWhatsapp ?? "") !== (depois.celularWhatsapp ?? "")) mudou.push("celular");
  const aN = antes.dataNascimento?.toISOString().slice(0, 10) ?? "";
  const dN = depois.dataNascimento?.toISOString().slice(0, 10) ?? "";
  if (aN !== dN) mudou.push("data de nascimento");
  if ((antes.observacao ?? "") !== (depois.observacao ?? "")) mudou.push("observação");
  return mudou.length
    ? `Campos alterados: ${mudou.join(", ")}.`
    : "Sem alterações de dados (possivelmente só a foto).";
}

// Cria ou atualiza um membro (id presente = edição). A foto, quando enviada,
// já chega redimensionada para 300×300 pelo cliente e vai para o Storage.
// Admin/super editam tudo; o LÍDER edita só dados de perfil dos membros da
// própria equipe (sem e-mail/equipe) e nunca cria — ver acessoMembros().
export async function salvarMembro(
  _prev: EstadoMembro,
  formData: FormData,
): Promise<EstadoMembro> {
  const usuario = await requireUsuario();
  const acesso = acessoMembros(usuario);
  // "somente_leitura" (monitor) nunca cria/edita — sem isso cairia no ramo
  // "admin/super: acesso total" (nunca é `restrito`) e poderia criar membros.
  if (acesso === "nenhum" || acesso === "somente_leitura") {
    return falha("Você não tem acesso ao cadastro de membros.");
  }
  const restrito = acesso === "equipe";

  const id = String(formData.get("id") ?? "").trim() || null;
  const nomeCompleto = String(formData.get("nomeCompleto") ?? "").trim();
  const celular = String(formData.get("celular") ?? "").trim();
  const nascimentoStr = String(formData.get("dataNascimento") ?? "").trim();
  const observacao = String(formData.get("observacao") ?? "").trim();
  const foto = formData.get("foto");

  if (nomeCompleto.length < 3) return falha("Informe o nome completo.");
  if (celular.length > 20) return falha("O celular deve ter no máximo 20 caracteres.");

  let dataNascimento: Date | null = null;
  if (nascimentoStr) {
    dataNascimento = parseDataISO(nascimentoStr);
    if (!dataNascimento) return falha("Data de nascimento inválida.");
  }

  // ── Líder: escopo de equipe, só dados de perfil, nunca cria. ──
  if (restrito) {
    if (!id) return falha("Líderes não cadastram novos membros.");
    try {
      const antes = await prisma.membro.findUnique({ where: { id } });
      if (!antes) return falha("Membro não encontrado.");
      if (antes.equipeId !== usuario.equipeId) {
        return falha("Você só pode editar membros da sua equipe.");
      }

      const dadosPerfil = {
        nomeCompleto,
        celularWhatsapp: celular || null,
        dataNascimento,
        observacao: observacao || null,
      };
      await prisma.membro.update({ where: { id }, data: dadosPerfil });

      const detalhe = descreverMudancas(antes, dadosPerfil);
      await writeAudit({
        usuarioId: usuario.membroId,
        acao: "editar",
        tabelaAfetada: "membros",
        registroId: id,
        dadosAnteriores: {
          nomeCompleto: antes.nomeCompleto,
          celularWhatsapp: antes.celularWhatsapp,
          dataNascimento: antes.dataNascimento?.toISOString() ?? null,
          observacao: antes.observacao,
        },
        dadosNovos: { ...dadosPerfil, dataNascimento: dataNascimento?.toISOString() ?? null },
      });

      if (foto instanceof File && foto.size > 0) {
        const fotoUrl = await uploadFotoMembro(id, foto);
        await prisma.membro.update({ where: { id }, data: { fotoUrl } });
      }

      // Avisa admin/super que um líder editou o cadastro de um membro.
      await dispararNotificacaoMembroEditadoPorLider({
        membroEditadoId: id,
        membroEditadoNome: nomeCompleto,
        equipeNome: usuario.equipeNome,
        editorNome: usuario.nomeCompleto,
        editorMembroId: usuario.membroId,
        detalhe,
      });

      revalidarMembros(id);
      return { ...sucesso("Membro atualizado com sucesso.")!, membroId: id };
    } catch (erro) {
      return falha(
        `Erro ao salvar: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
      );
    }
  }

  // ── Admin/super: acesso total (cria/edita tudo, incl. e-mail e equipe). ──
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const equipeId = String(formData.get("equipeId") ?? "").trim() || null;
  if (!EMAIL_RE.test(email)) return falha("Informe um e-mail válido.");

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
      if (!podeEditarMembroAlvo(usuario, antes)) {
        return falha("Você não tem permissão para editar este cadastro.");
      }
      if (antes.nivelAcesso === "monitor" && equipeId) {
        return falha(
          "Monitores não participam de equipes — deixe o campo Equipe como “Sem equipe” ou mude o nível de acesso antes.",
        );
      }

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

// Define o status do membro (ativo/afastado/inativo) — nunca há exclusão
// física. As regras de transição, guardas e auditoria estão em
// src/lib/statusMembro.ts (compartilhadas com as ações em massa de /usuarios).
export async function definirStatusMembro(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_membros");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as StatusMembro;
  const motivo = String(formData.get("motivo") ?? "");
  const retornoPrevisto = String(formData.get("retornoPrevisto") ?? "");

  if (!["ativo", "afastado", "inativo"].includes(status)) {
    return falha("Status inválido.");
  }

  try {
    const r = await aplicarStatusMembro(usuario, id, status, motivo, retornoPrevisto);
    if (!r.ok) return falha(r.message);
    revalidarMembros(id);
    return sucesso(r.message);
  } catch (erro) {
    return falha(
      `Erro ao alterar status: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Remove a foto do membro (Storage + referência no cadastro). Admin/super em
// qualquer membro; líder só nos da própria equipe (foto é dado de perfil).
export async function removerFoto(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requireUsuario();
  const acesso = acessoMembros(usuario);
  if (acesso === "nenhum" || acesso === "somente_leitura") {
    return falha("Você não tem acesso ao cadastro de membros.");
  }
  const id = String(formData.get("id") ?? "");

  try {
    const membro = await prisma.membro.findUnique({ where: { id } });
    if (!membro) return falha("Membro não encontrado.");
    if (!podeEditarMembroAlvo(usuario, membro)) {
      return falha("Você não tem permissão para editar este cadastro.");
    }
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
