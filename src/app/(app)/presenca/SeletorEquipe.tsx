"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Equipe = { id: string; nome: string };

// Seletor de equipe (apenas admin/super_admin). Ao trocar de equipe, atualiza
// ?equipeId e limpa ?eventoId (o evento selecionado é específico da equipe).
export function SeletorEquipe({
  equipes,
  equipeIdAtual,
}: {
  equipes: Equipe[];
  equipeIdAtual: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(equipeId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("equipeId", equipeId);
    params.delete("eventoId");
    router.push(`/presenca?${params.toString()}`);
  }

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500">
        Equipe em foco
      </span>
      <select
        value={equipeIdAtual}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
      >
        {equipes.map((eq) => (
          <option key={eq.id} value={eq.id}>
            {eq.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
