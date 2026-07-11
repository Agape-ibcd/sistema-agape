"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";
import {
  calcularHorarioChegada,
  horarioValido,
  validarConfig,
  type ConfigRecorrencia,
} from "@/lib/recorrencia";
import { gerarInstanciasEventos, JANELA_MESES } from "@/lib/gerarEventos";
import type { CategoriaEvento, TipoRecorrencia } from "@prisma/client";

const RECORRENCIAS: TipoRecorrencia[] = [
  "diario",
  "semanal",
  "quinzenal",
  "mensal_dia_fixo",
  "mensal_posicao",
  "mensal_ultima_posicao",
  "avulso",
];
const CATEGORIAS: CategoriaEvento[] = [
  "culto_regular",
  "evento_extra",
  "campanha",
  "conferencia",
  "batismo",
  "outro",
];

function revalidarEventos(tipoId?: string) {
  revalidatePath("/eventos/tipos");
  if (tipoId) revalidatePath(`/eventos/tipos/${tipoId}`);
  revalidatePath("/eventos");
}

// Monta o config_recorrencia a partir dos campos condicionais do formulário.
function configDoFormulario(
  tipo: TipoRecorrencia,
  formData: FormData,
): ConfigRecorrencia {
  switch (tipo) {
    case "semanal":
      return {
        diasSemana: formData
          .getAll("diasSemana")
          .map((v) => Number(v))
          .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
      };
    case "quinzenal":
      return { dataBase: String(formData.get("dataBase") ?? "").trim() };
    case "mensal_dia_fixo":
      return { dia: Number(formData.get("diaMes")) };
    case "mensal_posicao":
      return {
        posicao: Number(formData.get("posicao")),
        diaSemana: Number(formData.get("diaSemana")),
      };
    case "mensal_ultima_posicao":
      return { diaSemana: Number(formData.get("diaSemana")) };
    default:
      return {};
  }
}

// Cria ou atualiza um tipo de evento. Ao mudar o horário de um tipo já
// existente, os eventos FUTUROS ainda agendados que seguiam o horário antigo
// são atualizados junto (edições manuais por evento são preservadas).
export async function salvarTipoEvento(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_tipos_evento");

  const id = String(formData.get("id") ?? "").trim() || null;
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const horarioInicio = String(formData.get("horarioInicio") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "culto_regular") as CategoriaEvento;
  const tipoRecorrencia = String(formData.get("tipoRecorrencia") ?? "") as TipoRecorrencia;
  const ativo = formData.get("ativo") === "on";

  if (nome.length < 3) return falha("Informe o nome do tipo de evento.");
  if (!horarioValido(horarioInicio)) return falha("Informe o horário de início (HH:MM).");
  if (!CATEGORIAS.includes(categoria)) return falha("Categoria inválida.");
  if (!RECORRENCIAS.includes(tipoRecorrencia)) return falha("Recorrência inválida.");

  const config = configDoFormulario(tipoRecorrencia, formData);
  const erroConfig = validarConfig(tipoRecorrencia, config);
  if (erroConfig) return falha(erroConfig);

  const horarioChegadaEquipe = calcularHorarioChegada(horarioInicio);
  const dados = {
    nome,
    descricao: descricao || null,
    horarioInicio,
    horarioChegadaEquipe,
    categoria,
    tipoRecorrencia,
    configRecorrencia: config as object,
    ativo,
  };

  try {
    if (id) {
      const antes = await prisma.tipoEvento.findUnique({ where: { id } });
      if (!antes) return falha("Tipo de evento não encontrado.");

      await prisma.tipoEvento.update({ where: { id }, data: dados });

      // Propaga o novo horário para eventos futuros que seguiam o antigo.
      let eventosAtualizados = 0;
      if (antes.horarioInicio !== horarioInicio) {
        const agora = new Date();
        const hoje = new Date(
          Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()),
        );
        const { count } = await prisma.evento.updateMany({
          where: {
            tipoEventoId: id,
            status: "agendado",
            dataEvento: { gte: hoje },
            horarioInicio: antes.horarioInicio,
          },
          data: { horarioInicio, horarioChegadaEquipe },
        });
        eventosAtualizados = count;
      }

      await writeAudit({
        usuarioId: usuario.membroId,
        acao: "editar",
        tabelaAfetada: "tipos_evento",
        registroId: id,
        dadosAnteriores: {
          nome: antes.nome,
          horarioInicio: antes.horarioInicio,
          tipoRecorrencia: antes.tipoRecorrencia,
          configRecorrencia: antes.configRecorrencia,
          categoria: antes.categoria,
          ativo: antes.ativo,
        },
        dadosNovos: dados,
      });

      revalidarEventos(id);
      return sucesso(
        `Tipo de evento atualizado.` +
          (eventosAtualizados > 0
            ? ` ${eventosAtualizados} evento(s) futuro(s) tiveram o horário ajustado para ${horarioInicio} (chegada ${horarioChegadaEquipe}).`
            : ""),
      );
    }

    const criado = await prisma.tipoEvento.create({
      data: { ...dados, criadoPor: usuario.membroId },
    });

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "criar",
      tabelaAfetada: "tipos_evento",
      registroId: criado.id,
      dadosNovos: dados,
    });

    revalidarEventos(criado.id);
    return sucesso(
      `Tipo de evento criado (chegada da equipe calculada: ${horarioChegadaEquipe}). Use "Gerar eventos" para criar as instâncias no calendário.`,
    );
  } catch (erro) {
    return falha(
      `Erro ao salvar: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Gera as instâncias dos próximos 3 meses (todos os tipos ativos ou um só).
export async function gerarEventos(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_tipos_evento");
  const tipoEventoId = String(formData.get("tipoEventoId") ?? "").trim() || undefined;

  try {
    const resultados = await gerarInstanciasEventos({
      tipoEventoId,
      criadoPor: usuario.membroId,
    });

    if (resultados.length === 0) {
      return falha("Nenhum tipo de evento ativo com recorrência para gerar.");
    }

    const totalCriados = resultados.reduce((s, r) => s + r.criados, 0);
    const linhas = resultados.map((r) =>
      r.erro
        ? `${r.tipoNome}: ${r.erro}`
        : `${r.tipoNome}: ${r.criados} criado(s), ${r.jaExistiam} já existia(m)`,
    );

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: "gerar_eventos",
      tabelaAfetada: "eventos",
      dadosNovos: { janelaMeses: JANELA_MESES, resultados },
    });

    revalidarEventos(tipoEventoId);
    return sucesso(
      `Geração concluída (janela de ${JANELA_MESES} meses): ${totalCriados} evento(s) novo(s). ${linhas.join(" · ")}`,
    );
  } catch (erro) {
    return falha(
      `Erro na geração: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}
