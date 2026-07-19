"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { Popover } from "@/components/Popover";

const ROTULO_STATUS: Record<string, string> = {
  ativo: "Ativos",
  afastado: "Afastados",
  inativo: "Inativos",
  todos: "Todos",
};

// Busca + filtros da lista de membros. A busca fica à mão (campo principal,
// aplica com Enter ou após pausa na digitação); equipe/status ficam
// recolhidos num menu suspenso que aplica na hora — sem botão "Filtrar".
export function FiltrosMembros({
  busca,
  equipe,
  status,
  equipes,
}: {
  busca: string;
  equipe: string;
  status: string;
  equipes: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navegar(proximo: { busca?: string; equipe?: string; status?: string }) {
    const p = new URLSearchParams();
    const b = proximo.busca ?? busca;
    const e = proximo.equipe ?? equipe;
    const s = proximo.status ?? status;
    if (b) p.set("busca", b);
    if (e) p.set("equipe", e);
    if (s && s !== "ativo") p.set("status", s); // "ativo" é o padrão do servidor
    const qs = p.toString();
    iniciar(() => router.push(qs ? `/membros?${qs}` : "/membros"));
  }

  const qtdFiltros = (equipe ? 1 : 0) + (status !== "ativo" ? 1 : 0);

  const inputCls =
    "w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";

  return (
    <div
      className={`mb-4 flex flex-wrap items-center gap-2 transition-opacity ${pendente ? "opacity-70" : ""}`}
    >
      <input
        type="search"
        aria-label="Buscar por nome ou e-mail"
        defaultValue={busca}
        placeholder="Buscar por nome ou e-mail"
        className={`${inputCls} min-w-40 flex-1`}
        onChange={(e) => {
          const valor = e.target.value.trim();
          if (debounce.current) clearTimeout(debounce.current);
          debounce.current = setTimeout(() => navegar({ busca: valor }), 400);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (debounce.current) clearTimeout(debounce.current);
            navegar({ busca: e.currentTarget.value.trim() });
          }
        }}
      />

      <Popover rotulo="Filtros" badge={qtdFiltros} align="right">
        {(fechar) => (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
              Equipe
              <select
                value={equipe}
                onChange={(e) => {
                  navegar({ equipe: e.target.value });
                  fechar();
                }}
                className={inputCls}
              >
                <option value="">Todas as equipes</option>
                {equipes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
              Situação
              <select
                value={status}
                onChange={(e) => {
                  navegar({ status: e.target.value });
                  fechar();
                }}
                className={inputCls}
              >
                {Object.entries(ROTULO_STATUS).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </label>

            {qtdFiltros > 0 && (
              <button
                type="button"
                onClick={() => {
                  navegar({ equipe: "", status: "ativo" });
                  fechar();
                }}
                className="self-end rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-soft underline-offset-2 hover:text-danger-text hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </Popover>
    </div>
  );
}
