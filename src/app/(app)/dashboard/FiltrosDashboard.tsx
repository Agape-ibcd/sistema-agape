"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { formatarDataISO } from "@/lib/recorrencia";
import type {
  EscopoDashboard,
  FiltrosDashboard as Filtros,
  OpcoesFiltro,
} from "@/lib/dashboard";

// Barra de filtros globais (período, equipe, tipo de culto, membro). Aplica
// automaticamente ao alterar qualquer campo — sem botão "Aplicar". Navega por
// querystring (URL compartilhável; os mesmos parâmetros alimentam as exportações).
// Seletores de equipe/membro são ocultados quando o escopo já os fixa.

export function FiltrosDashboard({
  filtros,
  opcoes,
  escopo,
}: {
  filtros: Filtros;
  opcoes: OpcoesFiltro;
  escopo: EscopoDashboard;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  // Monta a querystring a partir do estado atual do formulário (campos vazios
  // são omitidos → o servidor cai no padrão) e navega.
  function aplicar(form: HTMLFormElement) {
    const p = new URLSearchParams();
    for (const [chave, valor] of new FormData(form).entries()) {
      const v = String(valor).trim();
      if (v) p.set(chave, v);
    }
    const qs = p.toString();
    iniciar(() => router.push(qs ? `/dashboard?${qs}` : "/dashboard"));
  }

  // Rechaveia o form quando os filtros resolvidos mudam, para os campos
  // (não controlados) refletirem a URL — inclusive ao "Limpar".
  const chave = [
    formatarDataISO(filtros.inicio),
    formatarDataISO(filtros.fim),
    filtros.equipeId ?? "",
    filtros.tipoEventoId ?? "",
    filtros.membroId ?? "",
  ].join("|");

  const inputCls =
    "w-full min-w-0 max-w-full rounded-xl border border-edge px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring sm:w-auto";
  const labelCls =
    "flex w-full flex-col gap-1 text-xs font-medium text-ink-soft sm:w-auto";

  const mostrarEquipe = escopo === "geral";
  const mostrarMembro = escopo !== "proprio";

  return (
    <form
      key={chave}
      onChange={(e) => aplicar(e.currentTarget)}
      onSubmit={(e) => {
        e.preventDefault();
        aplicar(e.currentTarget);
      }}
      className={`mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-edge-soft bg-surface p-4 transition-opacity ${
        pendente ? "opacity-60" : ""
      }`}
    >
      <label className={labelCls}>
        Início
        <input
          type="date"
          name="inicio"
          defaultValue={formatarDataISO(filtros.inicio)}
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        Fim
        <input
          type="date"
          name="fim"
          defaultValue={formatarDataISO(filtros.fim)}
          className={inputCls}
        />
      </label>

      {mostrarEquipe && (
        <label className={labelCls}>
          Equipe
          <select
            name="equipe"
            defaultValue={filtros.equipeId ?? ""}
            className={inputCls}
          >
            <option value="">Todas as equipes</option>
            {opcoes.equipes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className={labelCls}>
        Tipo de culto
        <select
          name="tipo"
          defaultValue={filtros.tipoEventoId ?? ""}
          className={inputCls}
        >
          <option value="">Todos os tipos</option>
          {opcoes.tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </label>

      {mostrarMembro && (
        <label className={labelCls}>
          Membro
          <select
            name="membro"
            defaultValue={filtros.membroId ?? ""}
            className={inputCls}
          >
            <option value="">Todos os membros</option>
            {opcoes.membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex items-center gap-3">
        <span
          className="text-xs text-ink-faint"
          aria-live="polite"
          aria-busy={pendente}
        >
          {pendente ? "Atualizando…" : ""}
        </span>
        <button
          type="button"
          onClick={() => iniciar(() => router.push("/dashboard"))}
          className="rounded-xl border border-edge bg-surface px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2"
        >
          Limpar
        </button>
      </div>
    </form>
  );
}
