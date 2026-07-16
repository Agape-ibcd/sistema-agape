import { requireUsuario } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  resolverFiltros,
  escopoDoUsuario,
  filtrosParaQuery,
  type ParamsDashboard,
} from "@/lib/dashboard";
import { BotoesExportacao } from "./BotoesExportacao";
import { DashboardDados } from "./DashboardDados";
import { formatarDataISO } from "@/lib/recorrencia";

// Dashboard analítico (Etapa 5). Três visões por nível, resolvidas no servidor:
//  • geral   (admin/super_admin) — todas as equipes, filtros livres.
//  • equipe  (líder)            — travado na própria equipe.
//  • proprio (membro)           — travado no próprio desempenho.
//
// Casca sem banco: só resolve os filtros (função pura) e delega os dados
// pesados (KPIs/gráficos/tabelas) ao DashboardDados, que busca no navegador
// via SWR — mantém o último dado conhecido no dispositivo entre navegações
// e revalida em segundo plano (ver plano de cache no dispositivo).

const TITULO: Record<string, string> = {
  geral: "Dashboard",
  equipe: "Dashboard da equipe",
  proprio: "Meu desempenho",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<ParamsDashboard>;
}) {
  const usuario = await requireUsuario();
  const params = await searchParams;
  const filtros = resolverFiltros(usuario, params);
  const escopo = escopoDoUsuario(usuario);
  const query = filtrosParaQuery(filtros);

  const periodo = `${filtros.inicio.toLocaleDateString("pt-BR", { timeZone: "UTC" })} a ${filtros.fim.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold uppercase tracking-wide text-ink">
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

      <DashboardDados
        escopo={escopo}
        query={query}
        periodo={periodo}
        filtrosSerializados={{
          inicio: formatarDataISO(filtros.inicio),
          fim: formatarDataISO(filtros.fim),
          equipeId: filtros.equipeId,
          tipoEventoId: filtros.tipoEventoId,
          membroId: filtros.membroId,
        }}
      />
    </div>
  );
}
