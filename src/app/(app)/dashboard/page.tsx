import { requireUsuario } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  carregarDashboard,
  filtrosParaQuery,
  type ParamsDashboard,
} from "@/lib/dashboard";
import { FiltrosDashboard } from "./FiltrosDashboard";
import { GraficosDashboard } from "./Graficos";
import { TabelaDesempenho } from "./TabelaDesempenho";
import { BotoesExportacao } from "./BotoesExportacao";
import { RegistrosDetalhados } from "./RegistrosDetalhados";

// Dashboard analítico (Etapa 5). Três visões por nível, resolvidas no servidor:
//  • geral   (admin/super_admin) — todas as equipes, filtros livres.
//  • equipe  (líder)            — travado na própria equipe.
//  • proprio (membro)           — travado no próprio desempenho.

const TITULO: Record<string, string> = {
  geral: "Dashboard",
  equipe: "Dashboard da equipe",
  proprio: "Meu desempenho",
};

function KpiCard({
  rotulo,
  valor,
  sub,
  destaque,
}: {
  rotulo: string;
  valor: string;
  sub?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        destaque
          ? "border-brand-edge bg-brand-faint"
          : "border-edge-soft bg-surface"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
        {rotulo}
      </p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          destaque ? "text-brand-text" : "text-ink"
        }`}
      >
        {valor}
      </p>
      {sub && <p className="mt-0.5 text-xs text-ink-subtle">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<ParamsDashboard>;
}) {
  const usuario = await requireUsuario();
  const params = await searchParams;
  const dados = await carregarDashboard(usuario, params);
  const { kpis, filtros, escopo } = dados;
  const query = filtrosParaQuery(filtros);

  const periodo = `${filtros.inicio.toLocaleDateString("pt-BR", { timeZone: "UTC" })} a ${filtros.fim.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`;

  const fmt = (v: number) => `${v.toFixed(1)}%`;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {TITULO[escopo]}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Período: <span className="font-medium text-ink">{periodo}</span>
            {escopo === "equipe" && usuario.equipeNome
              ? ` · ${usuario.equipeNome}`
              : ""}
          </p>
        </div>
        <BotoesExportacao
          query={query}
          escopo={escopo}
          mostrarAgenda={can(usuario.nivelAcesso, "exportar_agenda")}
        />
      </header>

      <FiltrosDashboard filtros={filtros} opcoes={dados.opcoes} escopo={escopo} />

      {/* KPIs principais */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          rotulo="Convocações"
          valor={String(kpis.convocacoes)}
          sub="lançamentos no período"
        />
        <KpiCard
          rotulo="Membros ativos"
          valor={String(kpis.membrosAtivos)}
          sub="distintos na presença"
        />
        <KpiCard
          rotulo="Taxa de presença"
          valor={fmt(kpis.taxaPresenca)}
          sub={`${kpis.presentes} de ${kpis.convocacoes}`}
          destaque
        />
        <KpiCard
          rotulo="Pontualidade"
          valor={fmt(kpis.taxaPontualidade)}
          sub={`${kpis.pontuais} de ${kpis.presentes} presentes`}
          destaque
        />
      </div>

      {/* KPIs secundários */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        <KpiCard rotulo="Presentes" valor={String(kpis.presentes)} />
        <KpiCard
          rotulo="Cadastrados ativos"
          valor={String(dados.membrosCadastradosAtivos)}
          sub="indicador administrativo"
        />
      </div>

      {/* Gráficos */}
      <section className="mb-6">
        <GraficosDashboard
          porEquipe={dados.porEquipe}
          porTipo={dados.porTipo}
          porEvento={dados.porEvento}
          composicao={dados.composicao}
          mostrarEquipes={escopo === "geral"}
        />
      </section>

      {/* Desempenho individual */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-ink">
          Desempenho individual
        </h2>
        <TabelaDesempenho
          dados={dados.desempenho}
          mostrarEquipe={escopo === "geral"}
        />
      </section>

      {/* Registros detalhados */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">
          Registros detalhados
        </h2>
        <RegistrosDetalhados registros={dados.registros} escopo={escopo} />
      </section>
    </div>
  );
}
