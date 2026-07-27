import "server-only";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { parseDataISO, formatarDataISO } from "@/lib/recorrencia";
import { intervaloPeriodo, PERIODO_PADRAO } from "@/lib/periodos";
import { membrosConvocados } from "@/lib/escalaMembros";
import type { UsuarioAtual } from "@/lib/auth";
import type { Prisma, Pontualidade } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────
// Analytics do Dashboard (Etapa 5) — fonte única dos KPIs, gráficos, tabelas
// e das exportações. Regras fechadas com o usuário e verificadas contra a base:
//
//  • Convocações        = nº de lançamentos ATIVOS (excluidoEm IS NULL) no período.
//  • Escalados          = nº de convocações da ESCALA no período (pessoa × culto),
//                         independente de a presença ter sido lançada. Difere de
//                         "Convocações" justamente quando falta lançar presença.
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

// ── Escopo por nível de acesso ───────────────────────────────────────────
// geral   → admin/super_admin/monitor: vê tudo, filtra qualquer equipe/membro
//           (o monitor é só leitura — exportar/visualizar, nunca gravar).
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

// Resolve os filtros a partir da querystring APLICANDO as restrições de escopo
// no servidor — nunca confia no que veio do cliente para equipe/membro.
export function resolverFiltros(
  usuario: UsuarioAtual,
  params: ParamsDashboard,
): FiltrosDashboard {
  const escopo = escopoDoUsuario(usuario);

  // Padrão sem período na URL: a SEMANA ATUAL (domingo a sábado).
  const padrao = intervaloPeriodo(PERIODO_PADRAO);
  const inicio = (params.inicio && parseDataISO(params.inicio)) || padrao.inicio;
  const fim = (params.fim && parseDataISO(params.fim)) || padrao.fim;

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

// ── Escalados (convocação da ESCALA, não do lançamento de presença) ──────
// Uma linha por pessoa × culto escalado. Respeita a convocação parcial
// (EscalaMembro): escala sem linhas convoca a equipe inteira, escala com
// linhas convoca só o subconjunto — a mesma regra que a tela de presença
// aplica, para que os números batam com o que o líder vê para lançar.
// Eventos cancelados ficam de fora (não acontecem, logo não convocam).
export type LinhaEscalado = {
  eventoId: string;
  tipoEventoId: string;
  tipoEventoNome: string;
  categoria: string;
  dataEvento: Date;
  horarioInicio: string;
  descricaoEspecifica: string | null;
  equipeId: string;
  equipeNome: string;
  corHex: string | null;
  membroId: string;
};

export async function carregarEscalados(
  filtros: FiltrosDashboard,
): Promise<LinhaEscalado[]> {
  const escalas = await prisma.escalaEquipeEvento.findMany({
    where: {
      ...(filtros.equipeId ? { equipeId: filtros.equipeId } : {}),
      evento: {
        dataEvento: { gte: filtros.inicio, lte: filtros.fim },
        status: { not: "cancelado" },
        ...(filtros.tipoEventoId ? { tipoEventoId: filtros.tipoEventoId } : {}),
      },
    },
    include: {
      evento: {
        select: {
          id: true,
          tipoEventoId: true,
          dataEvento: true,
          horarioInicio: true,
          descricaoEspecifica: true,
          tipoEvento: { select: { nome: true, categoria: true } },
        },
      },
      equipe: {
        select: {
          id: true,
          nome: true,
          corHex: true,
          membros: { where: { status: "ativo" }, select: { id: true } },
        },
      },
      membrosEscalados: { select: { membroId: true } },
    },
  });

  const linhas: LinhaEscalado[] = [];
  for (const esc of escalas) {
    const convocados = membrosConvocados(esc.equipe.membros, esc.membrosEscalados);
    for (const m of convocados) {
      // Escopo "próprio" (membro): só as próprias convocações.
      if (filtros.membroId && m.id !== filtros.membroId) continue;
      linhas.push({
        eventoId: esc.evento.id,
        tipoEventoId: esc.evento.tipoEventoId,
        tipoEventoNome: esc.evento.tipoEvento.nome,
        categoria: esc.evento.tipoEvento.categoria,
        dataEvento: esc.evento.dataEvento,
        horarioInicio: esc.evento.horarioInicio,
        descricaoEspecifica: esc.evento.descricaoEspecifica,
        equipeId: esc.equipe.id,
        equipeNome: esc.equipe.nome,
        corHex: esc.equipe.corHex,
        membroId: m.id,
      });
    }
  }
  return linhas;
}

// Série do gráfico empilhado: por tipo de culto, quantos escalados de cada
// equipe. `equipes` é a legenda/ordem das faixas da pilha.
export type EscaladosPorTipo = {
  equipes: { equipeId: string; nome: string; corHex: string | null }[];
  linhas: {
    tipoEventoId: string;
    nome: string;
    total: number;
    porEquipe: Record<string, number>; // equipeId → escalados
  }[];
};

export function escaladosPorTipo(linhas: LinhaEscalado[]): EscaladosPorTipo {
  const equipes = new Map<string, { equipeId: string; nome: string; corHex: string | null }>();
  const tipos = new Map<string, EscaladosPorTipo["linhas"][number]>();
  // Auxiliares só para a ordenação final (regular × cronológico — mesma
  // regra de seriesPorTipo/ordenarTiposEEventos).
  const regularPorId = new Map<EscaladosPorTipo["linhas"][number], boolean>();
  const timestampPorId = new Map<EscaladosPorTipo["linhas"][number], number>();

  for (const l of linhas) {
    if (!equipes.has(l.equipeId)) {
      equipes.set(l.equipeId, {
        equipeId: l.equipeId,
        nome: l.equipeNome,
        corHex: l.corHex,
      });
    }
    // Mesma regra de seriesPorTipo: culto regular agrega por tipo; evento
    // avulso/extra agrega por evento individual.
    const regular = l.categoria === "culto_regular";
    const id = regular ? l.tipoEventoId : l.eventoId;
    let t = tipos.get(id);
    if (!t) {
      t = {
        tipoEventoId: id,
        nome: regular
          ? l.tipoEventoNome
          : rotuloEventoAvulso(
              l.dataEvento,
              l.horarioInicio,
              l.descricaoEspecifica,
              l.tipoEventoNome,
            ),
        total: 0,
        porEquipe: {},
      };
      tipos.set(id, t);
      regularPorId.set(t, regular);
      timestampPorId.set(t, timestampEvento(l.dataEvento, l.horarioInicio));
    }
    t.total += 1;
    t.porEquipe[l.equipeId] = (t.porEquipe[l.equipeId] ?? 0) + 1;
  }

  return {
    equipes: [...equipes.values()].sort((a, b) => a.nome.localeCompare(b.nome)),
    linhas: [...tipos.values()].sort((a, b) => {
      const regA = regularPorId.get(a) ?? true;
      const regB = regularPorId.get(b) ?? true;
      if (regA !== regB) return regA ? -1 : 1;
      if (!regA && !regB) {
        return (timestampPorId.get(a) ?? 0) - (timestampPorId.get(b) ?? 0);
      }
      return b.total - a.total;
    }),
  };
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

// Detalhamento por equipe dentro de um tipo de culto (para o hover/relatório).
export type SerieEquipeMini = {
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
  // Equipes escaladas neste tipo de culto, com presença e % de cada uma.
  equipes: SerieEquipeMini[];
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

function dataCurta(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

function rotuloEvento(l: LinhaPresenca): string {
  return `${dataCurta(l.evento.dataEvento)} · ${l.evento.descricaoEspecifica ?? l.evento.tipoEvento.nome}`;
}

// Eventos avulsos/extras (categoria ≠ culto_regular) podem repetir o mesmo
// tipoEvento no mesmo dia (ex.: 4 eventos "Evento Especial" com horários
// diferentes) — por isso não podem ser agrupados por tipoEventoId como o
// culto regular é. O rótulo inclui o horário para diferenciá-los mesmo
// quando não há descrição específica.
function timestampEvento(dataEvento: Date, horarioInicio: string): number {
  const [h, m] = horarioInicio.split(":").map(Number);
  return dataEvento.getTime() + (h * 60 + m) * 60_000;
}

// Ordena: cultos regulares primeiro (pela regra de sempre — mais convocado
// primeiro), eventos avulsos/extras depois, em ordem cronológica (data+hora,
// do mais antigo para o mais recente) — pedido do usuário, já que um evento
// avulso não faz sentido ordenar por convocações (são instâncias únicas).
function ordenarTiposEEventos<T extends { convocacoes: number }>(
  arr: T[],
  regularPorId: Map<T, boolean>,
  timestampPorId: Map<T, number>,
): T[] {
  return arr.sort((a, b) => {
    const regA = regularPorId.get(a) ?? true;
    const regB = regularPorId.get(b) ?? true;
    if (regA !== regB) return regA ? -1 : 1;
    if (!regA && !regB) {
      return (timestampPorId.get(a) ?? 0) - (timestampPorId.get(b) ?? 0);
    }
    return b.convocacoes - a.convocacoes;
  });
}

function rotuloEventoAvulso(
  dataEvento: Date,
  horarioInicio: string,
  descricaoEspecifica: string | null,
  tipoEventoNome: string,
): string {
  const base = `${dataCurta(dataEvento)} · ${horarioInicio}`;
  return descricaoEspecifica
    ? `${base} · ${descricaoEspecifica}`
    : `${base} · ${tipoEventoNome}`;
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
  // Detalhamento equipe→números dentro de cada tipo.
  const equipesPorTipo = new Map<string, Map<string, SerieEquipeMini>>();
  // Auxiliares só para a ordenação final (regular × cronológico).
  const regularPorId = new Map<SerieTipo, boolean>();
  const timestampPorId = new Map<SerieTipo, number>();

  for (const l of linhas) {
    // Culto regular agrega por tipo (todas as ocorrências no período); evento
    // avulso/extra agrega por evento individual (mesmo tipo pode repetir no
    // mesmo dia com horários diferentes — ver rotuloEventoAvulso).
    const regular = l.evento.tipoEvento.categoria === "culto_regular";
    const id = regular ? l.evento.tipoEvento.id : l.eventoId;
    let s = mapa.get(id);
    if (!s) {
      s = {
        tipoEventoId: id,
        nome: regular
          ? l.evento.tipoEvento.nome
          : rotuloEventoAvulso(
              l.evento.dataEvento,
              l.evento.horarioInicio,
              l.evento.descricaoEspecifica,
              l.evento.tipoEvento.nome,
            ),
        convocacoes: 0,
        presentes: 0,
        taxaPresenca: 0,
        equipes: [],
      };
      mapa.set(id, s);
      equipesPorTipo.set(id, new Map());
      regularPorId.set(s, regular);
      timestampPorId.set(s, timestampEvento(l.evento.dataEvento, l.evento.horarioInicio));
    }
    s.convocacoes += 1;
    if (l.presente) s.presentes += 1;

    const eqMap = equipesPorTipo.get(id)!;
    let e = eqMap.get(l.equipeId);
    if (!e) {
      e = {
        equipeId: l.equipeId,
        nome: l.equipe.nome,
        corHex: l.equipe.corHex,
        convocacoes: 0,
        presentes: 0,
        taxaPresenca: 0,
      };
      eqMap.set(l.equipeId, e);
    }
    e.convocacoes += 1;
    if (l.presente) e.presentes += 1;
  }

  const arr = [...mapa.values()];
  for (const s of arr) {
    s.taxaPresenca = pct(s.presentes, s.convocacoes);
    const eqMap = equipesPorTipo.get(s.tipoEventoId)!;
    for (const e of eqMap.values()) e.taxaPresenca = pct(e.presentes, e.convocacoes);
    s.equipes = [...eqMap.values()].sort((a, b) => b.presentes - a.presentes);
  }
  return ordenarTiposEEventos(arr, regularPorId, timestampPorId);
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
          // Afastados entram no filtro: têm histórico a consultar.
          status: { not: "inativo" },
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
  escalados: number; // pessoa × culto escalado no período
  escaladosPorTipo: EscaladosPorTipo;
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
  const [linhas, escalados, opcoes, cadAtivos] = await Promise.all([
    carregarPresencas(filtros),
    carregarEscalados(filtros),
    opcoesDeFiltro(usuario, filtros),
    membrosCadastradosAtivos(filtros),
  ]);

  return {
    escopo: escopoDoUsuario(usuario),
    filtros,
    kpis: calcularKpis(linhas),
    membrosCadastradosAtivos: cadAtivos,
    escalados: escalados.length,
    escaladosPorTipo: escaladosPorTipo(escalados),
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
