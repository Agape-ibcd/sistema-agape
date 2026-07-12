"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";
import { parseDataISO, formatarDataISO } from "@/lib/recorrencia";
import {
  domingoDaSemana,
  validarCicloRodizio,
  type EntradaCiclo,
} from "@/lib/rodizio";
import { aplicarRodizioNoBanco } from "@/lib/aplicarRodizio";

// Server Actions da configuração do rodízio de escalas.

function revalidar() {
  revalidatePath("/eventos/rodizio");
  revalidatePath("/eventos");
}

// Salva (upsert do singleton) a configuração: âncora + ciclo + ativo.
export async function salvarRodizio(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_escalas");

  const ancoraStr = String(formData.get("semanaAncora") ?? "").trim();
  const ativo = formData.get("ativo") === "on";
  const manhas = formData.getAll("manha").map(String);
  const noites = formData.getAll("noite").map(String);

  const dataAncora = parseDataISO(ancoraStr);
  if (!dataAncora) return falha("Informe a data da semana âncora.");
  // Qualquer data vale: o ciclo é sempre ancorado no DOMINGO daquela semana.
  const semanaAncora = domingoDaSemana(dataAncora);

  if (manhas.length === 0 || manhas.length !== noites.length) {
    return falha("Configure as equipes de todas as semanas do ciclo.");
  }
  const ciclo: EntradaCiclo[] = manhas.map((manha, i) => ({
    manha,
    noite: noites[i],
  }));

  try {
    const equipes = await prisma.equipe.findMany({
      where: { status: "ativa" },
      select: { id: true },
    });
    const erro = validarCicloRodizio(ciclo, new Set(equipes.map((e) => e.id)));
    if (erro) return falha(erro);

    const existente = await prisma.rodizioEscala.findFirst({
      orderBy: { dataCriacao: "asc" },
    });

    const dados = {
      ativo,
      semanaAncora,
      ciclo: ciclo as unknown as object,
    };

    if (existente) {
      await prisma.rodizioEscala.update({ where: { id: existente.id }, data: dados });
    } else {
      await prisma.rodizioEscala.create({
        data: { ...dados, criadoPor: usuario.membroId },
      });
    }

    await writeAudit({
      usuarioId: usuario.membroId,
      acao: existente ? "editar" : "criar",
      tabelaAfetada: "rodizio_escala",
      registroId: existente?.id,
      dadosAnteriores: existente
        ? {
            ativo: existente.ativo,
            semanaAncora: formatarDataISO(existente.semanaAncora),
            ciclo: existente.ciclo,
          }
        : undefined,
      dadosNovos: { ativo, semanaAncora: formatarDataISO(semanaAncora), ciclo },
    });

    revalidar();
    return sucesso(
      `Rodízio ${ativo ? "salvo e ativo" : "salvo (inativo)"} — ciclo de ${ciclo.length} semana(s), âncora no domingo ${semanaAncora.toLocaleDateString("pt-BR", { timeZone: "UTC" })}. Use "Aplicar rodízio" para preencher as escalas.`,
    );
  } catch (erro) {
    return falha(
      `Erro ao salvar o rodízio: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}

// Aplica o rodízio aos eventos do período informado.
export async function aplicarRodizio(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("gerenciar_escalas");

  const inicio = parseDataISO(String(formData.get("inicio") ?? "").trim());
  const fim = parseDataISO(String(formData.get("fim") ?? "").trim());
  if (!inicio || !fim) return falha("Informe o período de aplicação.");
  if (inicio.getTime() > fim.getTime()) {
    return falha("O início do período deve ser anterior ao fim.");
  }

  try {
    const resultado = await aplicarRodizioNoBanco({
      usuarioId: usuario.membroId,
      inicio,
      fim,
    });
    if (!resultado) {
      return falha("Salve e ative a configuração do rodízio antes de aplicar.");
    }

    revalidar();
    const partes = [
      `${resultado.criadas} escala(s) criada(s)`,
      resultado.removidas > 0 ? `${resultado.removidas} corrigida(s)` : null,
      `${resultado.eventosJaCorretos} evento(s) já corretos`,
      resultado.eventosPersonalizados > 0
        ? `${resultado.eventosPersonalizados} com escala manual (preservados)`
        : null,
      resultado.eventosForaDeEscopo > 0
        ? `${resultado.eventosForaDeEscopo} cancelado(s)/realizado(s) ignorados`
        : null,
    ].filter(Boolean);

    const avisos =
      resultado.avisos.length > 0
        ? ` Avisos: ${resultado.avisos.slice(0, 3).join(" · ")}${resultado.avisos.length > 3 ? ` (+${resultado.avisos.length - 3})` : ""}`
        : "";

    return sucesso(
      `Rodízio aplicado a ${resultado.totalEventos} evento(s): ${partes.join(", ")}.${avisos}`,
    );
  } catch (erro) {
    return falha(
      `Erro ao aplicar o rodízio: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
    );
  }
}
