"use client";

import { useState, useMemo } from "react";
import type { DesempenhoMembro } from "@/lib/dashboard";

// Tabela de desempenho individual, sortável por qualquer coluna (client).
// Ordena por presença desc por padrão (já vem ordenada do servidor).

type Coluna = {
  chave: keyof DesempenhoMembro;
  rotulo: string;
  numerico: boolean;
  pct?: boolean;
};

const COLUNAS: Coluna[] = [
  { chave: "nome", rotulo: "Membro", numerico: false },
  { chave: "equipeNome", rotulo: "Equipe", numerico: false },
  { chave: "convocacoes", rotulo: "Conv.", numerico: true },
  { chave: "presentes", rotulo: "Pres.", numerico: true },
  { chave: "ausentes", rotulo: "Aus.", numerico: true },
  { chave: "taxaPresenca", rotulo: "% Presença", numerico: true, pct: true },
  { chave: "taxaPontualidade", rotulo: "% Pontual.", numerico: true, pct: true },
];

export function TabelaDesempenho({
  dados,
  mostrarEquipe,
}: {
  dados: DesempenhoMembro[];
  mostrarEquipe: boolean;
}) {
  const [ordenarPor, setOrdenarPor] = useState<keyof DesempenhoMembro>("taxaPresenca");
  const [desc, setDesc] = useState(true);

  const colunas = mostrarEquipe
    ? COLUNAS
    : COLUNAS.filter((c) => c.chave !== "equipeNome");

  const ordenados = useMemo(() => {
    const arr = [...dados];
    arr.sort((a, b) => {
      const va = a[ordenarPor];
      const vb = b[ordenarPor];
      let cmp: number;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), "pt-BR");
      return desc ? -cmp : cmp;
    });
    return arr;
  }, [dados, ordenarPor, desc]);

  const clicar = (chave: keyof DesempenhoMembro, numerico: boolean) => {
    if (chave === ordenarPor) {
      setDesc((d) => !d);
    } else {
      setOrdenarPor(chave);
      setDesc(numerico); // números começam desc (maior primeiro); texto asc
    }
  };

  if (dados.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
        Nenhum membro com lançamentos no período/seleção.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
            {colunas.map((c) => (
              <th key={c.chave} className={c.numerico ? "px-3 py-2.5 text-right" : "px-3 py-2.5"}>
                <button
                  type="button"
                  onClick={() => clicar(c.chave, c.numerico)}
                  className={`inline-flex items-center gap-1 font-medium hover:text-emerald-700 ${
                    ordenarPor === c.chave ? "text-emerald-700" : ""
                  }`}
                >
                  {c.rotulo}
                  {ordenarPor === c.chave && (
                    <span aria-hidden>{desc ? "↓" : "↑"}</span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {ordenados.map((d) => (
            <tr key={d.membroId} className="hover:bg-zinc-50">
              <td className="px-3 py-2.5 font-medium text-zinc-900">{d.nome}</td>
              {mostrarEquipe && (
                <td className="px-3 py-2.5 text-zinc-600">{d.equipeNome}</td>
              )}
              <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">
                {d.convocacoes}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">
                {d.presentes}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">
                {d.ausentes}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-zinc-900">
                {d.taxaPresenca.toFixed(1)}%
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">
                {d.presentes > 0 ? `${d.taxaPontualidade.toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
