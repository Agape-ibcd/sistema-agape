"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { requirePermissao, requireUsuario } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { uploadFotoMembro, removerFotoMembro } from "@/lib/storage";
import { parseDataISO } from "@/lib/recorrencia";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";
import { obterBotUsername } from "@/lib/telegram";
import { dispararNotificacaoPerfilEditado } from "@/lib/notificacoesEnvio";
import { solicitarAlteracaoPerfil } from "@/lib/alteracaoPerfil";

// Ações do próprio perfil. Todas exigem `editar_perfil_proprio` — hoje
// concedida a todos os níveis, inclusive monitor (ajuste de 2026-07-19).

// Após trocar dados que aparecem no menu (foto), revalida o layout inteiro.
function revalidarPerfil() {
  revalidatePath("/", "layout");
}

// Atualiza a observação do próprio perfil — único campo de texto livre que
// segue com edição IMEDIATA (nome/e-mail/celular/nascimento passaram a
// exigir confirmação por e-mail/Telegram, ver `solicitarAlteracaoDados`
// abaixo — pedido do usuário em 2026-07-27, retomado em 2026-08-13).
export async function atualizarPerfil(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("editar_perfil_proprio");

  const observacao = String(formData.get("observacao") ?? "").trim();

  try {
    const antes = await prisma.membro.findUnique({
      where: { id: usuario.membroId },
      select: { observacao: true },
    });

    const depois = await prisma.membro.update({
      where: { id: usuario.membroId },
      data: { observacao: observacao || null },
      select: { observacao: true },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "editar",
      tabelaAfetada: "membros",
      registroId: usuario.membroId,
      dadosAnteriores: antes,
      dadosNovos: depois,
    });

    if ((antes?.observacao ?? "") !== (depois.observacao ?? "")) {
      await dispararNotificacaoPerfilEditado({
        membroId: usuario.membroId,
        membroNome: usuario.nomeCompleto,
        equipeId: usuario.equipeId,
        detalhe: "Campos alterados: observação.",
      });
    }

    revalidatePath("/perfil");
    return sucesso("Observação atualizada com sucesso.");
  } catch (erro) {
    return falha(
      `Erro ao salvar: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Pede a alteração de nome/e-mail/celular/nascimento — não aplica na hora:
// gera um link de confirmação (válido por 24h) mandado ao e-mail/Telegram
// ATUAIS do membro. `solicitarAlteracaoPerfil` (src/lib/alteracaoPerfil.ts)
// valida, guarda o pedido e envia; a aplicação de fato acontece em
// `confirmarAlteracaoPerfil`, disparada pela página pública do link.
export async function solicitarAlteracaoDados(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("editar_perfil_proprio");

  const nome = String(formData.get("nomeCompleto") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const celular = String(formData.get("celular") ?? "").trim();
  const nascimentoStr = String(formData.get("dataNascimento") ?? "").trim();

  if (celular.length > 20) {
    return falha("O celular deve ter no máximo 20 caracteres.");
  }
  let dataNascimento: Date | null = null;
  if (nascimentoStr) {
    dataNascimento = parseDataISO(nascimentoStr);
    if (!dataNascimento) return falha("Data de nascimento inválida.");
  }

  const resultado = await solicitarAlteracaoPerfil(usuario.membroId, {
    nomeCompleto: nome,
    email,
    celularWhatsapp: celular || null,
    dataNascimento,
  });

  if (!resultado.ok) return falha(resultado.motivo);

  revalidatePath("/perfil");
  const canaisTexto = resultado.canais
    .map((c) => (c === "email" ? "e-mail" : "Telegram"))
    .join(" e ");
  return sucesso(
    `Enviamos um link de confirmação por ${canaisTexto}. Ele vale por 24 horas — a alteração só entra em vigor depois que você confirmar.`,
  );
}

// Troca a senha do próprio usuário: confirma a senha ATUAL num cliente
// descartável (sem tocar na sessão) e grava a nova na sessão corrente.
// Disponível a todos os níveis — credencial de acesso não é dado do sistema,
// então o monitor também pode. (Troca de e-mail vai por outro fluxo — ver
// `solicitarAlteracaoDados` abaixo, com confirmação por link.)
export async function alterarSenha(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requireUsuario();

  const senhaAtual = String(formData.get("senhaAtual") ?? "");
  const senhaNova = String(formData.get("senhaNova") ?? "");
  const senhaConfirma = String(formData.get("senhaConfirma") ?? "");

  if (!senhaAtual) return falha("Informe a senha atual.");
  if (senhaNova.length < 8) {
    return falha("A nova senha deve ter pelo menos 8 caracteres.");
  }
  if (senhaNova !== senhaConfirma) {
    return falha("A confirmação não confere com a nova senha.");
  }
  if (senhaNova === senhaAtual) {
    return falha("A nova senha deve ser diferente da atual.");
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return falha("Sessão inválida — entre novamente.");

    // Confirma a senha atual sem interferir nos cookies da sessão.
    const verificador = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: erroAtual } = await verificador.auth.signInWithPassword({
      email: user.email,
      password: senhaAtual,
    });
    if (erroAtual) return falha("Senha atual incorreta.");

    const { error } = await supabase.auth.updateUser({ password: senhaNova });
    if (error) return falha(`Supabase Auth: ${error.message}`);

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "alterar_senha",
      tabelaAfetada: "membros",
      registroId: usuario.membroId,
    });

    return sucesso("Senha alterada com sucesso.");
  } catch (erro) {
    return falha(
      `Erro ao alterar a senha: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Troca a foto do próprio perfil — mesmo fluxo do cadastro de membros:
// a imagem chega 300×300 do cliente e vai para o bucket `fotos-membros`.
export async function atualizarFotoPerfil(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("editar_perfil_proprio");
  const foto = formData.get("foto");

  if (!(foto instanceof File) || foto.size === 0) {
    return falha("Escolha uma imagem JPG ou PNG.");
  }

  try {
    const fotoUrl = await uploadFotoMembro(usuario.membroId, foto);
    const antes = await prisma.membro.findUnique({
      where: { id: usuario.membroId },
      select: { fotoUrl: true },
    });
    await prisma.membro.update({
      where: { id: usuario.membroId },
      data: { fotoUrl },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "editar",
      tabelaAfetada: "membros",
      registroId: usuario.membroId,
      dadosAnteriores: { fotoUrl: antes?.fotoUrl ?? null },
      dadosNovos: { fotoUrl },
    });

    revalidarPerfil();
    return sucesso("Foto atualizada com sucesso.");
  } catch (erro) {
    return falha(
      `Erro ao enviar a foto: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Remove a foto do próprio perfil (Storage + referência no cadastro).
// Sem parâmetros: o useActionState passa (estado, formData), ambos ignorados.
export async function removerFotoPerfil(): Promise<EstadoAcao> {
  const usuario = await requirePermissao("editar_perfil_proprio");

  try {
    const membro = await prisma.membro.findUnique({
      where: { id: usuario.membroId },
      select: { fotoUrl: true },
    });
    if (!membro?.fotoUrl) return falha("Você não tem foto cadastrada.");

    await removerFotoMembro(usuario.membroId);
    await prisma.membro.update({
      where: { id: usuario.membroId },
      data: { fotoUrl: null },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "editar",
      tabelaAfetada: "membros",
      registroId: usuario.membroId,
      dadosAnteriores: { fotoUrl: membro.fotoUrl },
      dadosNovos: { fotoUrl: null },
    });

    revalidarPerfil();
    return sucesso("Foto removida.");
  } catch (erro) {
    return falha(
      `Erro ao remover a foto: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Vínculo do Telegram (Etapa 6 parte 2). Gera um token opaco de curta
// duração e devolve o deep link t.me/<bot>?start=<token> — o vínculo de
// verdade (telegramChatId) só acontece quando o membro clica e o webhook
// recebe o /start (src/app/api/telegram/webhook/route.ts).
export type EstadoVinculoTelegram = (NonNullable<EstadoAcao> & { link?: string }) | null;

export async function gerarLinkTelegram(): Promise<EstadoVinculoTelegram> {
  const usuario = await requirePermissao("editar_perfil_proprio");

  const username = await obterBotUsername();
  if (!username) {
    return falha("Não foi possível falar com o Telegram agora — tente novamente em instantes.");
  }

  const token = randomUUID().replace(/-/g, "");
  const expira = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.membro.update({
    where: { id: usuario.membroId },
    data: { telegramLinkToken: token, telegramLinkExpira: expira },
  });

  return {
    ...sucesso("Link gerado — válido por 30 minutos.")!,
    link: `https://t.me/${username}?start=${token}`,
  };
}

// Desvincula o Telegram (limpa chatId e desliga o canal). Não some com o
// histórico de LogNotificacao — só interrompe envios futuros por lá.
export async function desvincularTelegram(): Promise<EstadoAcao> {
  const usuario = await requirePermissao("editar_perfil_proprio");

  try {
    await prisma.membro.update({
      where: { id: usuario.membroId },
      data: { telegramChatId: null, notifTelegram: false },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "editar",
      tabelaAfetada: "membros",
      registroId: usuario.membroId,
      dadosNovos: { telegramChatId: null, notifTelegram: false },
    });

    revalidatePath("/perfil");
    return sucesso("Telegram desvinculado.");
  } catch (erro) {
    return falha(
      `Erro ao desvincular: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}
