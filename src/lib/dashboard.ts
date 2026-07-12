import "server-only";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { parseDataISO, formatarDataISO } from "@/lib/recorrencia";
import type { UsuarioAtual } from "@/lib/auth";
import type { Prisma, Pontualidade } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────
// Analytics do Dashboard (Etapa 5) — fonte única dos KPIs, gráficos, tabelas
// e das exportações. Regras fechadas com o usuário e verificadas contra a base:
//
//  • Convocações        = nº de lançamentos ATIVOS (excluidoEm IS NULL) no período.
//  • Membros Ativos     = contagem DISTINTA de membros na PRESENCA no período
//                         (conceito do dashboard HTML — NÃO é "membros cadastrados").
//  • Taxa de Presença   = presentes / convocações.
//  • Taxa de Ausência   = ausentes / convocações.
//  • Taxa de Pontualidade = pontuais / presentes.
//  • Taxa de Atrasos    = atrasados / presentes.
//
// Referência confirmada (17/05–14/06/2026): 237 convocações · 45,1% presença ·
// 71,0% pontualidade · 45 membros ativos distintos.
//
// Todos os cálculos consideram apenas presenças ativas (regra da Etapa 4). As
// exportações podem opcionalmente incluir linhas excluídas (com status), mas
// elas nunca entram nos KPIs.
// ─────────────────────────────────────────────────────────────────────────

const DIA_MS = 86_400_000;

// ── Escopo por nível de acesso ───────────────────────────────────────────
// geral   → admin/super_admin: vê tudo, filtra qualquer equipe/membro.
// equipe  → líder: travado na própria equipe.
// proprio → membro: travado no próprio cadastro.
export type EscopoDashboard = "geral" | "equipe" | "proprio";

export function escopoDoUsuario(usuario: UsuarioAtual): EscopoDashboard {
  if (can(usuario.nivelAcesso, "dashboard_geral")) return "geral";
  if (can(usuario.nivelAcesso, "dashboard_equipe")) return "equipe";
  return "proprio";
}

export type ParamsDashboard = {
  inicio?: string; // YYYY-MM-DD
  fim?: string; // YYYY-MM-DD
  equipe?: string;
  tipo?: string;
  membro?: string;
};

export type FiltrosDashboard = {
  inicio: Date; // UTC meia-noite
  fim: Date; // UTC meia-noite (inclusive)
  equipeId: string | null;
  tipoEventoId: string | null;
  membroId: string | null;
};

function hojeUTC(): Date {
  const a = new Date();
  return new Date(Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()));
}

// Resolve os filtros a partir da querystring APLICANDO as restrições de escopo
// no servidor — nunca confia no que veio do cliente para equipe/membro.
export function resolverFiltros(
  usuario: UsuarioAtual,
  params: ParamsDashboard,
): FiltrosDashboard {
  const escopo = escopoDoUsuario(usuario);

  const hoje = hojeUTC();
  const padraoInicio = new Date(hoje.getTime() - 90 * DIA_MS);
  const inicio = (params.inicio && parseDataISO(params.inicio)) || padraoInicio;
  const fim = (params.fim && parseDataISO(params.fim)) || hoje;

  let equipeId: string | null = params.equipe?.trim() || null;
  let membroId: string | null = params.membro?.trim() || null;
  const tipoEventoId: string | null = params.tipo?.trim() || null;

  if (escopo === "equipe") {
    // Líder: sempre a própria equipe (ignora o que veio na URL).
    equipeId = usuario.equipeId;
  } else if (escopo === "proprio") {
    // Membro: sempre o próprio cadastro; equipe implícita.
    membroId = usuario.membroId;
    equipeId = usuario.equipeId;
  }

  // Garante início ≤ fim.
  if (inicio.getTime() > fim.getTime()) {
    return { inicio: fim, fim: inicio, equipeId, tipoEventoId, membroId };
  }
  return { inicio, fim, equipeId, tipoEventoId, membroId };
}

// ── Carregamento das linhas de presença ──────────────────────────────────
export type LinhaPresenca = Prisma.PresencaGetPayload<{
  include: {
    evento: { include: { tipoEvento: { select: { id: true; nome: true; categoria: true } } } };
    equipe: { select: { id: true; nome: true; corHex: true } };
    membro: { select: { id: true; nomeCompleto: true } };
  };
}>;

// Carrega as presenças do período respeitando os filtros. Por padrão só as
// ativas; `incluirExcluidas` traz também as excluídas (para a trilha detalhada).
export async function carregarPresencas(
  filtros: FiltrosDashboard,
  incluirExcluidas = false,
): Promise<LinhaPresenca[]> {
  const where: Prisma.PresencaWhereInput = {
    ...(incluirExcluidas ? {} : { excluidoEm: null }),
    ...(filtros.equipeId ? { equipeId: filtros.equipeId } : {}),
    ...(filtros.membroId ? { membroId: filtros.membroId } : {}),
    evento: {
      dataEvento: { gte: filtros.inicio, lte: filtros.fim },
      ...(filtros.tipoEventoId ? { tipoEventoId: filtros.tipoEventoId } : {}),
    },
  };

  return prisma.presenca.findMany({
    where,
    include: {
      evento: {
        include: {
          tipoEvento: { select: { id: true, nome: true, categoria: true } },
        },
      },
      equipe: { select: { id: true, nome: true, corHex: true } },
      membro: { select: { id: true, nomeCompleto: true } },
    },
    orderBy: [{ evento: { dataEvento: "asc" } }, { membro: { nomeCompleto: "asc" } }],
  });
}

// ── KPIs ─────────────────────────────────────────────────────────────────
export type Kpis = {
  convocacoes: number;
  presentes: number;
  ausentes: number;
  pontuais: number;
  atrasados: number;
  membrosAtivos: number; // distinct em PRESENCA (conceito do dashboard)
  taxaPresenca: number; // %
  taxaAusencia: number; // %
  taxaPontualidade: number; // %
  taxaAtrasos: number; // %
};

function pct(n: number, d: number): number {
  return d === 0 ? 0 : (n / d) * 100;
}

function ehPontual(p: { presente: boolean; pontualidade: Pontualidade | null }) {
  return p.presente && p.pontualidade === "pontual";
}

export function calcularKpis(linhas: LinhaPresenca[]): Kpis {
  const convocacoes = linhas.length;
  const presentes = linhas.filter((l) => l.presente).length;
  const ausentes = convocacoes - presentes;
  const pontuais = linhas.filter(ehPontual).length;
  const atrasados = presentes - pontuais;
  const membrosAtivos = new Set(linhas.map((l) => l.membroId)).size;

  return {
    convocacoes,
    presentes,
    ausentes,
    pontuais,
    atrasados,
    membrosAtivos,
    taxaPresenca: pct(presentes, convocacoes),
    taxaAusencia: pct(ausentes, convocacoes),
    taxaPontualidade: pct(pontuais, presentes),
    taxaAtrasos: pct(atrasados, presentes),
  };
}

// ── Séries dos gráficos ──────────────────────────────────────────────────
export type SerieEquipe = {
  equipeId: string;
  nome: string;
  corHex: string | null;
  convocacoes: number;
  presentes: number;
  taxaPresenca: number;
};

export type SerieTipo = {
  tipoEventoId: string;
  nome: string;
  convocacoes: number;
  presentes: number;
  taxaPresenca: number;
};

export type SerieEvento = {
  eventoId: string;
  data: string; // ISO
  rotulo: string; // "24/05 · Domingo Manhã"
  convocacoes: number;
  presentes: number;
  taxaPresenca: number;
};

export type Composicao = {
  pontuais: number;
  atrasados: number;
  ausentes: number;
};

function rotuloEvento(l: LinhaPresenca): string {
  const d = l.evento.dataEvento.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
  return `${d} · ${l.evento.descricaoEspecifica ?? l.evento.tipoEvento.nome}`;
}

export function seriesPorEquipe(linhas: LinhaPresenca[]): SerieEquipe[] {
  const mapa = new Map<string, SerieEquipe>();
  for (const l of linhas) {
    let s = mapa.get(l.equipeId);
    if (!s) {
      s = {
        equipeId: l.equipeId,
        nome: l.equipe.nome,
        corHex: l.equipe.corHex,
        convocacoes: 0,
        presentes: 0,
        taxaPresenca: 0,
      };
      mapa.set(l.equipeId, s);
    }
    s.convocacoes += 1;
    if (l.presente) s.presentes += 1;
  }
  const arr = [...mapa.values()];
  arr.forEach((s) => (s.taxaPresenca = pct(s.presentes, s.convocacoes)));
  return arr.sort((a, b) => b.taxaPresenca - a.taxaPresenca);
}

export function seriesPorTipo(linhas: LinhaPresenca[]): SerieTipo[] {
  const mapa = new Map<string, SerieTipo>();
  for (const l of linhas) {
    const id = l.evento.tipoEvento.id;
    let s = mapa.get(id);
    if (!s) {
      s = {
        tipoEventoId: id,
        nome: l.evento.tipoEvento.nome,
        convocacoes: 0,
        presentes: 0,
        taxaPresenca: 0,
      };
      mapa.set(id, s);
    }
    s.convocacoes += 1;
    if (l.presente) s.presentes += 1;
  }
  const arr = [...mapa.values()];
  arr.forEach((s) => (s.taxaPresenca = pct(s.presentes, s.convocacoes)));
  return arr.sort((a, b) => b.convocacoes - a.convocacoes);
}

export function seriesPorEvento(linhas: LinhaPresenca[]): SerieEvento[] {
  const mapa = new Map<string, SerieEvento>();
  for (const l of linhas) {
    let s = mapa.get(l.eventoId);
    if (!s) {
      s = {
        eventoId: l.eventoId,
        data: formatarDataISO(l.evento.dataEvento),
        rotulo: rotuloEvento(l),
        convocacoes: 0,
        presentes: 0,
        taxaPresenca: 0,
      };
      mapa.set(l.eventoId, s);
    }
    s.convocacoes += 1;
    if (l.presente) s.presentes += 1;
  }
  const arr = [...mapa.values()];
  arr.forEach((s) => (s.taxaPresenca = pct(s.presentes, s.convocacoes)));
  return arr.sort((a, b) => a.data.localeCompare(b.data));
}

export function composicao(linhas: LinhaPresenca[]): Composicao {
  let pontuais = 0;
  let atrasados = 0;
  let ausentes = 0;
  for (const l of linhas) {
    if (!l.presente) ausentes += 1;
    else if (l.pontualidade === "pontual") pontuais += 1;
    else atrasados += 1;
  }
  return { pontuais, atrasados, ausentes };
}

// ── Desempenho individual (tabela sortável) ──────────────────────────────
export type DesempenhoMembro = {
  membroId: string;
  nome: string;
  equipeNome: string;
  convocacoes: number;
  presentes: number;
  ausentes: number;
  pontuais: number;
  atrasados: number;
  taxaPresenca: number;
  taxaPontualidade: number;
};

export function desempenhoIndividual(linhas: LinhaPresenca[]): DesempenhoMembro[] {
  const mapa = new Map<string, DesempenhoMembro>();
  for (const l of linhas) {
    let d = mapa.get(l.membroId);
    if (!d) {
      d = {
        membroId: l.membroId,
        nome: l.membro.nomeCompleto,
        equipeNome: l.equipe.nome,
        convocacoes: 0,
        presentes: 0,
        ausentes: 0,
        pontuais: 0,
        atrasados: 0,
        taxaPresenca: 0,
        taxaPontualidade: 0,
      };
      mapa.set(l.membroId, d);
    }
    d.convocacoes += 1;
    if (l.presente) {
      d.presentes += 1;
      if (l.pontualidade === "pontual") d.pontuais += 1;
      else d.atrasados += 1;
    } else {
      d.ausentes += 1;
    }
  }
  const arr = [...mapa.values()];
  arr.forEach((d) => {
    d.taxaPresenca = pct(d.presentes, d.convocacoes);
    d.taxaPontualidade = pct(d.pontuais, d.presentes);
  });
  return arr.sort((a, b) => b.taxaPresenca - a.taxaPresenca || a.nome.localeCompare(b.nome));
}

// ── Registros detalhados (para tabela e exportação) ──────────────────────
export type RegistroDetalhado = {
  id: string;
  data: string; // ISO
  dataBR: string; // dd/mm/aaaa
  eventoNome: string;
  tipoEventoNome: string;
  equipeNome: string;
  membroNome: string;
  situacao: "Presente" | "Ausente";
  pontualidade: string; // "Pontual" | "Atrasado" | "—"
  horarioChegada: string;
  justificativa: string;
  excluido: boolean;
  excluidoEmBR: string;
  motivoExclusao: string;
  restauradoEmBR: string;
};

function dataBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function dataHoraBR(d: Date | null): string {
  return d
    ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "";
}

export function registrosDetalhados(linhas: LinhaPresenca[]): RegistroDetalhado[] {
  return linhas.map((l) => ({
    id: l.id,
    data: formatarDataISO(l.evento.dataEvento),
    dataBR: dataBR(l.evento.dataEvento),
    eventoNome: l.evento.descricaoEspecifica ?? l.evento.tipoEvento.nome,
    tipoEventoNome: l.evento.tipoEvento.nome,
    equipeNome: l.equipe.nome,
    membroNome: l.membro.nomeCompleto,
    situacao: l.presente ? "Presente" : "Ausente",
    pontualidade: l.presente
      ? l.pontualidade === "pontual"
        ? "Pontual"
        : "Atrasado"
      : "—",
    horarioChegada: l.horarioChegada ?? "",
    justificativa: l.justificativaAusencia ?? "",
    excluido: l.excluidoEm !== null,
    excluidoEmBR: dataHoraBR(l.excluidoEm),
    motivoExclusao: l.motivoExclusao ?? "",
    restauradoEmBR: dataHoraBR(l.restauradoEm),
  }));
}

// ── Opções de filtro (respeitando o escopo) ──────────────────────────────
export type OpcoesFiltro = {
  equipes: { id: string; nome: string }[];
  tipos: { id: string; nome: string }[];
  membros: { id: string; nome: string }[];
};

export async function opcoesDeFiltro(
  usuario: UsuarioAtual,
  filtros: FiltrosDashboard,
): Promise<OpcoesFiltro> {
  const escopo = escopoDoUsuario(usuario);

  // Equipes: escopo geral vê todas; líder/membro veem apenas a própria.
  const equipes =
    escopo === "geral"
      ? await prisma.equipe.findMany({
          where: { status: "ativa" },
          orderBy: { nome: "asc" },
          select: { id: true, nome: true },
        })
      : usuario.equipeId
        ? [{ id: usuario.equipeId, nome: usuario.equipeNome ?? "Minha equipe" }]
        : [];

  const tipos = await prisma.tipoEvento.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  // Membros: geral → todos (ou da equipe filtrada); líder → da própria equipe;
  // membro → apenas ele (não usa o seletor).
  let membros: { id: string; nome: string }[] = [];
  if (escopo !== "proprio") {
    const equipeParaMembros =
      escopo === "equipe" ? usuario.equipeId : filtros.equipeId;
    membros = (
      await prisma.membro.findMany({
        where: {
          status: "ativo",
          ...(equipeParaMembros ? { equipeId: equipeParaMembros } : {}),
        },
        orderBy: { nomeCompleto: "asc" },
        select: { id: true, nomeCompleto: true },
      })
    ).map((m) => ({ id: m.id, nome: m.nomeCompleto }));
  }

  return {
    equipes,
    tipos: tipos.map((t) => ({ id: t.id, nome: t.nome })),
    membros,
  };
}

// Indicador administrativo separado: membros cadastrados ativos na seleção.
export async function membrosCadastradosAtivos(
  filtros: FiltrosDashboard,
): Promise<number> {
  return prisma.membro.count({
    where: {
      status: "ativo",
      ...(filtros.equipeId ? { equipeId: filtros.equipeId } : {}),
      ...(filtros.membroId ? { id: filtros.membroId } : {}),
    },
  });
}

// ── Agregado completo para a página ──────────────────────────────────────
export type DadosDashboard = {
  escopo: EscopoDashboard;
  filtros: FiltrosDashboard;
  kpis: Kpis;
  membrosCadastradosAtivos: number;
  porEquipe: SerieEquipe[];
  porTipo: SerieTipo[];
  porEvento: SerieEvento[];
  composicao: Composicao;
  desempenho: DesempenhoMembro[];
  registros: RegistroDetalhado[];
  opcoes: OpcoesFiltro;
};

export async function carregarDashboard(
  usuario: UsuarioAtual,
  params: ParamsDashboard,
): Promise<DadosDashboard> {
  const filtros = resolverFiltros(usuario, params);
  const [linhas, opcoes, cadAtivos] = await Promise.all([
    carregarPresencas(filtros),
    opcoesDeFiltro(usuario, filtros),
    membrosCadastradosAtivos(filtros),
  ]);

  return {
    escopo: escopoDoUsuario(usuario),
    filtros,
    kpis: calcularKpis(linhas),
    membrosCadastradosAtivos: cadAtivos,
    porEquipe: seriesPorEquipe(linhas),
    porTipo: seriesPorTipo(linhas),
    porEvento: seriesPorEvento(linhas),
    composicao: composicao(linhas),
    desempenho: desempenhoIndividual(linhas),
    registros: registrosDetalhados(linhas),
    opcoes,
  };
}

// Serializa os filtros de volta para querystring (usado nos links de exportação).
export function filtrosParaQuery(filtros: FiltrosDashboard): string {
  const p = new URLSearchParams();
  p.set("inicio", formatarDataISO(filtros.inicio));
  p.set("fim", formatarDataISO(filtros.fim));
  if (filtros.equipeId) p.set("equipe", filtros.equipeId);
  if (filtros.tipoEventoId) p.set("tipo", filtros.tipoEventoId);
  if (filtros.membroId) p.set("membro", filtros.membroId);
  return p.toString();
}
