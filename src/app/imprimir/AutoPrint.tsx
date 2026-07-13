"use client";

import { useEffect } from "react";

// Dispara a caixa de impressão do navegador assim que a página de impressão
// carrega. É o mecanismo de "PDF" do plano (impressão do navegador → Salvar como PDF).
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-brand-faint px-4 py-3 text-sm text-brand-text print:hidden">
      <span>
        Use <strong>Salvar como PDF</strong> na caixa de impressão para gerar o
        arquivo.
      </span>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong"
      >
        Imprimir
      </button>
    </div>
  );
}
