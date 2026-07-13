import { requireUsuario } from "@/lib/auth";
import { ROTULO_NIVEL } from "@/lib/rbac";
import {
  carregarDashboard,
  type ParamsDashboard,
} from "@/lib/dashboard";
import { AutoPrint } from "../AutoPrint";

// Versão imprimível do dashboard (→ "Salvar como PDF"). Fora do (app) layout,
// sem menu, otimizada para papel. Respeita o mesmo escopo/filtros da tela.

export const metadata = { title: "Dashboard Ágape — impressão" };

const TITULO: Record<string, string> = {
  geral: "Dashboard — visão geral",
  equipe: "Dashboard — equipe",
  proprio: "Meu desempenho",
};

function pct(v: number) {
  return `${v.toFixed(1)}%`;
}

export default async function ImprimirDashboardPage({
  searchParams,
}: {
  searchParams: Promise<ParamsDashboard>;
}) {
  const usuario = await requireUsuario();
  const params = await searchParams;
  const dados = await carregarDashboard(usuario, params);
  const { kpis, filtros, escopo } = dados;

  const periodo = `${filtros.inicio.toLocaleDateString("pt-BR", { timeZone: "UTC" })} a ${filtros.fim.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`;

  const kpiLista: [string, string][] = [
    ["Convocações", String(kpis.convocacoes)],
    ["Membros ativos (distintos)", String(kpis.membrosAtivos)],
    ["Taxa de presença", pct(kpis.taxaPresenca)],
    ["Taxa de ausência", pct(kpis.taxaAusencia)],
    ["Pontualidade", pct(kpis.taxaPontualidade)],
    ["Atrasos", pct(kpis.taxaAtrasos)],
    ["Presentes", String(kpis.presentes)],
    ["Cadastrados ativos", String(dados.membrosCadastradosAtivos)],
  ];

  const th = "border-b border-edge px-2 py-1.5 text-left text-xs font-semibold uppercase text-ink-soft";
  const td = "border-b border-edge-soft px-2 py-1.5 text-sm text-ink";
  const tdNum = `${td} text-right tabular-nums`;

  return (
    <main className="mx-auto max-w-4xl bg-surface p-6 text-ink print:p-0">
      <AutoPrint />

      <header className="mb-4 border-b border-edge pb-3">
        <h1 className="text-xl font-bold">Ministério Ágape · IBCD Jundiaí/SP</h1>
        <p className="text-sm text-ink-soft">{TITULO[escopo]}</p>
        <p className="mt-1 text-xs text-ink-subtle">
          Período: {periodo}
          {escopo === "equipe" && usuario.equipeNome ? ` · ${usuario.equipeNome}` : ""}
          {" · "}Gerado por {usuario.nomeCompleto} ({ROTULO_NIVEL[usuario.nivelAcesso]})
          {" · "}
          {new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </p>
      </header>

      {/* KPIs */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase text-ink-soft">
          Indicadores
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
          {kpiLista.map(([rot, val]) => (
            <div key={rot} className="flex flex-col border-b border-edge-soft py-1">
              <span className="text-xs text-ink-subtle">{rot}</span>
              <span className="text-lg font-bold tabular-nums">{val}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Resumo por equipe */}
      {escopo === "geral" && dados.porEquipe.length > 0 && (
        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 text-sm font-semibold uppercase text-ink-soft">
            Resumo por equipe
          </h2>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Equipe</th>
                <th className={`${th} text-right`}>Convocações</th>
                <th className={`${th} text-right`}>Presentes</th>
                <th className={`${th} text-right`}>% Presença</th>
              </tr>
            </thead>
            <tbody>
              {dados.porEquipe.map((e) => (
                <tr key={e.equipeId}>
                  <td className={td}>{e.nome}</td>
                  <td className={tdNum}>{e.convocacoes}</td>
                  <td className={tdNum}>{e.presentes}</td>
                  <td className={tdNum}>{pct(e.taxaPresenca)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Resumo por tipo de culto */}
      {dados.porTipo.length > 0 && (
        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 text-sm font-semibold uppercase text-ink-soft">
            Resumo por tipo de culto
          </h2>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Tipo</th>
                <th className={`${th} text-right`}>Convocações</th>
                <th className={`${th} text-right`}>Presentes</th>
                <th className={`${th} text-right`}>% Presença</th>
              </tr>
            </thead>
            <tbody>
              {dados.porTipo.map((t) => (
                <tr key={t.tipoEventoId}>
                  <td className={td}>{t.nome}</td>
                  <td className={tdNum}>{t.convocacoes}</td>
                  <td className={tdNum}>{t.presentes}</td>
                  <td className={tdNum}>{pct(t.taxaPresenca)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Desempenho individual */}
      <section className="break-inside-avoid">
        <h2 className="mb-2 text-sm font-semibold uppercase text-ink-soft">
          Desempenho individual
        </h2>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Membro</th>
              {escopo === "geral" && <th className={th}>Equipe</th>}
              <th className={`${th} text-right`}>Conv.</th>
              <th className={`${th} text-right`}>Pres.</th>
              <th className={`${th} text-right`}>Aus.</th>
              <th className={`${th} text-right`}>% Presença</th>
              <th className={`${th} text-right`}>% Pontual.</th>
            </tr>
          </thead>
          <tbody>
            {dados.desempenho.map((d) => (
              <tr key={d.membroId}>
                <td className={td}>{d.nome}</td>
                {escopo === "geral" && <td className={td}>{d.equipeNome}</td>}
                <td className={tdNum}>{d.convocacoes}</td>
                <td className={tdNum}>{d.presentes}</td>
                <td className={tdNum}>{d.ausentes}</td>
                <td className={tdNum}>{pct(d.taxaPresenca)}</td>
                <td className={tdNum}>
                  {d.presentes > 0 ? pct(d.taxaPontualidade) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
