"use client";

import { useRouter } from "next/navigation";

// Troca o mês do painel só de escolher no select — sem botão "Ver".
export function SeletorMes({
  mes,
  nomesMeses,
}: {
  mes: number;
  nomesMeses: string[]; // índice 0 = janeiro
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Mês"
      value={mes}
      onChange={(e) => router.push(`/aniversariantes?mes=${e.target.value}`)}
      className="rounded-xl border border-edge px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
    >
      {nomesMeses.map((nome, i) => (
        <option key={i + 1} value={i + 1}>
          {nome}
        </option>
      ))}
    </select>
  );
}
