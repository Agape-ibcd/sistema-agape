import type { EscopoDashboard, RegistroDetalhado } from "@/lib/dashboard";

// Tabela de registros detalhados (somente presenças ativas — as que contam nos
// KPIs). Para o dump completo com status excluído/restaurado, usar a exportação.

const LIMITE = 150;

export function RegistrosDetalhados({
  registros,
  escopo,
}: {
  registros: RegistroDetalhado[];
  escopo: EscopoDashboard;
}) {
  if (registros.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-edge bg-surface p-8 text-center text-sm text-ink-subtle">
        Nenhum lançamento no período/seleção.
      </div>
    );
  }

  const mostrarMembro = escopo !== "proprio";
  const mostrarEquipe = escopo === "geral";
  const visiveis = registros.slice(0, LIMITE);

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-edge-soft bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-edge-soft text-left text-xs uppercase tracking-wide text-ink-subtle">
              <th className="px-3 py-2.5">Data</th>
              <th className="px-3 py-2.5">Evento</th>
              {mostrarEquipe && <th className="px-3 py-2.5">Equipe</th>}
              {mostrarMembro && <th className="px-3 py-2.5">Membro</th>}
              <th className="px-3 py-2.5">Situação</th>
              <th className="px-3 py-2.5">Pontualidade</th>
              <th className="px-3 py-2.5">Chegada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge-soft">
            {visiveis.map((r) => (
              <tr key={r.id} className="hover:bg-surface-2">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-soft">
                  {r.dataBR}
                </td>
                <td className="px-3 py-2 text-ink-soft">{r.eventoNome}</td>
                {mostrarEquipe && (
                  <td className="px-3 py-2 text-ink-soft">{r.equipeNome}</td>
                )}
                {mostrarMembro && (
                  <td className="px-3 py-2 font-medium text-ink">
                    {r.membroNome}
                  </td>
                )}
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.situacao === "Presente"
                        ? "bg-success-soft text-success-text"
                        : "bg-danger-soft text-danger-text"
                    }`}
                  >
                    {r.situacao}
                  </span>
                </td>
                <td className="px-3 py-2 text-ink-soft">{r.pontualidade}</td>
                <td className="px-3 py-2 tabular-nums text-ink-soft">
                  {r.horarioChegada || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {registros.length > LIMITE && (
        <p className="mt-2 text-xs text-ink-subtle">
          Mostrando os primeiros {LIMITE} de {registros.length} registros. Use a
          exportação para o conjunto completo.
        </p>
      )}
    </div>
  );
}
