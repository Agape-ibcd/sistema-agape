"use client";

import type { EscopoDashboard } from "@/lib/dashboard";
import { Popover } from "@/components/Popover";

// Botão único "Exportar" que abre o painel com as opções — evita a fileira de
// botões antiga. Cada link carrega a querystring dos filtros atuais, de modo
// que o arquivo gerado respeita exatamente a seleção da tela.

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
  const item =
    "block rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-brand-faint hover:text-brand-text";

  return (
    <Popover rotulo="Exportar" align="right">
      {() => (
        <div className="flex flex-col gap-0.5">
          <a className={item} href={`/api/exportar/presencas${q}`}>
            Presença (xlsx)
          </a>
          <a
            className={item}
            href={`/api/exportar/presencas${q}${q ? "&" : "?"}formato=csv`}
          >
            Presença (csv)
          </a>
          {escopo !== "proprio" && (
            <a className={item} href={`/api/exportar/resumo-membros${q}`}>
              Resumo por membro (xlsx)
            </a>
          )}
          {escopo === "geral" && (
            <a className={item} href={`/api/exportar/resumo-equipes${q}`}>
              Resumo por equipe (xlsx)
            </a>
          )}
          {mostrarAgenda && (
            <a className={item} href={`/api/exportar/agenda${q}`}>
              Agenda/escalas (xlsx)
            </a>
          )}
          <a
            className={item}
            href={`/imprimir/dashboard${q}`}
            target="_blank"
            rel="noopener"
          >
            Dashboard (PDF)
          </a>
        </div>
      )}
    </Popover>
  );
}
