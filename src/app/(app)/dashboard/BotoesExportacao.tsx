import type { EscopoDashboard } from "@/lib/dashboard";

// Botões de exportação — todos carregam a querystring dos filtros atuais, de
// modo que o arquivo gerado respeita exatamente a seleção da tela.

export function BotoesExportacao({
  query,
  escopo,
  mostrarAgenda = true,
}: {
  query: string;
  escopo: EscopoDashboard;
  // Exportar agenda/escalas exige ver_calendario (monitor não tem).
  mostrarAgenda?: boolean;
}) {
  const q = query ? `?${query}` : "";
  const btn =
    "rounded-lg border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-brand-edge hover:bg-brand-faint";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
        Exportar:
      </span>
      <a className={btn} href={`/api/exportar/presencas${q}`}>
        Presença (xlsx)
      </a>
      <a
        className={btn}
        href={`/api/exportar/presencas${q}${q ? "&" : "?"}formato=csv`}
      >
        Presença (csv)
      </a>
      {escopo !== "proprio" && (
        <a className={btn} href={`/api/exportar/resumo-membros${q}`}>
          Resumo por membro (xlsx)
        </a>
      )}
      {escopo === "geral" && (
        <a className={btn} href={`/api/exportar/resumo-equipes${q}`}>
          Resumo por equipe (xlsx)
        </a>
      )}
      {mostrarAgenda && (
        <a className={btn} href={`/api/exportar/agenda${q}`}>
          Agenda/escalas (xlsx)
        </a>
      )}
      <a className={btn} href={`/imprimir/dashboard${q}`} target="_blank" rel="noopener">
        Dashboard (PDF)
      </a>
    </div>
  );
}
