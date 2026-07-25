"use client";

import useSWR from "swr";
import type {
  DadosDashboard,
  EscopoDashboard,
  FiltrosDashboard as Filtros,
} from "@/lib/dashboard";
import { FiltrosDashboard } from "./FiltrosDashboard";
import { GraficosDashboard } from "./Graficos";
import { TabelaDesempenho } from "./TabelaDesempenho";
import { RegistrosDetalhados } from "./RegistrosDetalhados";
import { faixaDaTaxa, CLASSES_FAIXA, type FaixaCor } from "@/lib/kpiCores";
import { CoracaoCarregando } from "@/components/CoracaoCarregando";

const CINCO_MINUTOS_MS = 5 * 60 * 1000;

async function fetcher(url: string): Promise<DadosDashboard> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao buscar dashboard (${res.status})`);
  return res.json();
}

function fmt(v: number) {
  return `${v.toFixed(1)}%`;
}

function KpiCard({
  rotulo,
  valor,
  sub,
  faixa,
}: {
  rotulo: string;
  valor: string;
  sub?: string;
  // Quando informado, colore o card por faixa de taxa (ver src/lib/kpiCores.ts).
  faixa?: FaixaCor;
}) {
  const cores = faixa ? CLASSES_FAIXA[faixa] : null;
  return (
    <div
      className={`rounded-2xl border p-4 ${
        cores ? `${cores.border} ${cores.bg}` : "border-edge-soft vidro-leve"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
        {rotulo}
      </p>
      <p
        className={`mt-1 font-display text-3xl font-semibold tabular-nums ${
          cores ? cores.text : "text-ink"
        }`}
      >
        {valor}
      </p>
      {sub && <p className="mt-0.5 text-xs text-ink-subtle">{sub}</p>}
    </div>
  );
}

// Corpo do dashboard (KPIs, filtros, gráficos, tabelas) — busca os dados no
// navegador via SWR (chave = querystring canônica já escopada pelo
// servidor), mostrando o último dado conhecido no dispositivo enquanto
// atualiza em segundo plano. `keepPreviousData` evita tela em branco ao
// trocar filtro; `refreshInterval` cobre o caso de algo mudar (ex.: presença
// registrada em outra tela) enquanto o usuário fica parado nesta página.
export function DashboardDados({
  escopo,
  query,
  periodo,
  filtrosSerializados,
}: {
  escopo: EscopoDashboard;
  query: string;
  periodo: string;
  filtrosSerializados: {
    inicio: string;
    fim: string;
    equipeId: string | null;
    tipoEventoId: string | null;
    membroId: string | null;
  };
}) {
  const { data, error } = useSWR<DadosDashboard>(
    `/api/dashboard?${query}`,
    fetcher,
    { keepPreviousData: true, refreshInterval: CINCO_MINUTOS_MS },
  );

  if (error) {
    return (
      <div className="rounded-2xl border border-danger-edge bg-danger-faint p-6 text-center text-sm text-danger-text">
        Não foi possível carregar o dashboard. Se sua sessão expirou,{" "}
        <a href="/login" className="underline">
          faça login novamente
        </a>
        .
      </div>
    );
  }

  if (!data) {
    return <CoracaoCarregando texto="Carregando dashboard…" />;
  }

  const filtros: Filtros = {
    inicio: new Date(filtrosSerializados.inicio),
    fim: new Date(filtrosSerializados.fim),
    equipeId: filtrosSerializados.equipeId,
    tipoEventoId: filtrosSerializados.tipoEventoId,
    membroId: filtrosSerializados.membroId,
  };

  const { kpis } = data;

  return (
    <>
      <FiltrosDashboard filtros={filtros} opcoes={data.opcoes} escopo={escopo} />

      {/* KPIs principais — presença, pontualidade, ausência e atrasos, coloridas por faixa */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          rotulo="Taxa de presença"
          valor={fmt(kpis.taxaPresenca)}
          sub={`${kpis.presentes} de ${kpis.convocacoes}`}
          faixa={faixaDaTaxa(kpis.taxaPresenca)}
        />
        <KpiCard
          rotulo="Pontualidade"
          valor={fmt(kpis.taxaPontualidade)}
          sub={`${kpis.pontuais} de ${kpis.presentes} presentes`}
          faixa={faixaDaTaxa(kpis.taxaPontualidade)}
        />
        <KpiCard
          rotulo="Taxa de ausência"
          valor={fmt(kpis.taxaAusencia)}
          sub={`${kpis.ausentes} ausência(s)`}
        />
        <KpiCard
          rotulo="Atrasos"
          valor={fmt(kpis.taxaAtrasos)}
          sub={`${kpis.atrasados} atraso(s)`}
        />
      </div>

      {/* KPIs secundários */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          rotulo="Escalados"
          valor={String(data.escalados)}
          sub="convocações da escala no período"
        />
        <KpiCard rotulo="Presentes" valor={String(kpis.presentes)} />
        <KpiCard
          rotulo="Cadastrados ativos"
          valor={String(data.membrosCadastradosAtivos)}
          sub="indicador administrativo"
        />
      </div>

      {/* Gráficos */}
      <section className="mb-6">
        <GraficosDashboard
          porEquipe={data.porEquipe}
          porTipo={data.porTipo}
          porEvento={data.porEvento}
          escaladosPorTipo={data.escaladosPorTipo}
          composicao={data.composicao}
          mostrarEquipes={escopo === "geral"}
          periodo={periodo}
        />
      </section>

      {/* Desempenho individual */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-ink">
          Desempenho individual
        </h2>
        <TabelaDesempenho dados={data.desempenho} mostrarEquipe={escopo === "geral"} />
      </section>

      {/* Registros detalhados */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">
          Registros detalhados
        </h2>
        <RegistrosDetalhados registros={data.registros} escopo={escopo} />
      </section>
    </>
  );
}
