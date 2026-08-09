"use client";

import { useState } from "react";
import type { Prisma } from "@prisma/client";

// Expande/recolhe o JSON de dados anteriores/novos de um registro de
// auditoria — fica escondido por padrão para não poluir a tabela.
export function DetalheAuditoria({
  dadosAnteriores,
  dadosNovos,
}: {
  dadosAnteriores: Prisma.JsonValue | null;
  dadosNovos: Prisma.JsonValue | null;
}) {
  const [aberto, setAberto] = useState(false);

  if (!dadosAnteriores && !dadosNovos) {
    return <span className="text-ink-subtle">—</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="text-xs font-medium text-brand-text underline-offset-2 hover:underline"
      >
        {aberto ? "Ocultar" : "Ver detalhes"}
      </button>
      {aberto && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {dadosAnteriores !== null && (
            <div className="rounded-lg border border-edge-soft bg-surface-2 p-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                Antes
              </p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px] text-ink-soft">
                {JSON.stringify(dadosAnteriores, null, 2)}
              </pre>
            </div>
          )}
          {dadosNovos !== null && (
            <div className="rounded-lg border border-edge-soft bg-surface-2 p-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                Depois
              </p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px] text-ink-soft">
                {JSON.stringify(dadosNovos, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
