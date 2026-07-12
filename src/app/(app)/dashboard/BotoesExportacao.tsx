import type { EscopoDashboard } from "@/lib/dashboard";

// Botões de exportação — todos carregam a querystring dos filtros atuais, de
// modo que o arquivo gerado respeita exatamente a seleção da tela.

export function BotoesExportacao({
  query,
  escopo,
}: {
  query: string;
  escopo: EscopoDashboard;
}) {
  const q = query ? `?${query}` : "";
  const btn =
    "rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
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
      <a className={btn} href={`/api/exportar/agenda${q}`}>
        Agenda/escalas (xlsx)
      </a>
      <a className={btn} href={`/imprimir/dashboard${q}`} target="_blank" rel="noopener">
        Dashboard (PDF)
      </a>
    </div>
  );
}
