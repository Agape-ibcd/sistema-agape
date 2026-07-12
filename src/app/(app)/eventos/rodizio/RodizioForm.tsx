"use client";

import { useState, useActionState } from "react";
import { salvarRodizio, aplicarRodizio } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";

type Equipe = { id: string; nome: string; turnoPadrao: string };
type Semana = { manha: string; noite: string };

type Props = {
  equipes: Equipe[];
  // Config atual (ou defaults sugeridos pela página quando nunca configurado).
  cicloInicial: Semana[];
  ancoraInicial: string; // YYYY-MM-DD (domingo)
  ativoInicial: boolean;
  aplicarInicioPadrao: string; // YYYY-MM-DD
  aplicarFimPadrao: string; // YYYY-MM-DD
};

export function RodizioForm({
  equipes,
  cicloInicial,
  ancoraInicial,
  ativoInicial,
  aplicarInicioPadrao,
  aplicarFimPadrao,
}: Props) {
  const [estadoSalvar, salvarAction, pSalvar] = useActionState(salvarRodizio, null);
  const [estadoAplicar, aplicarAction, pAplicar] = useActionState(aplicarRodizio, null);
  const [semanas, setSemanas] = useState<Semana[]>(
    cicloInicial.length > 0 ? cicloInicial : [{ manha: "", noite: "" }, { manha: "", noite: "" }],
  );

  const inputCls =
    "w-full min-w-0 rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

  const mudar = (i: number, campo: keyof Semana, valor: string) =>
    setSemanas((s) => s.map((sem, j) => (j === i ? { ...sem, [campo]: valor } : sem)));

  const selectEquipe = (
    i: number,
    campo: keyof Semana,
    rotulo: string,
    turnoSugerido: string,
  ) => (
    <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-zinc-600">
      {rotulo}
      <select
        name={campo}
        required
        value={semanas[i][campo]}
        onChange={(e) => mudar(i, campo, e.target.value)}
        className={inputCls}
      >
        <option value="" disabled>
          Selecionar equipe…
        </option>
        {equipes.map((eq) => (
          <option key={eq.id} value={eq.id}>
            {eq.nome}
            {eq.turnoPadrao !== turnoSugerido && eq.turnoPadrao !== "variavel"
              ? " (outro turno)"
              : ""}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-5">
      {/* ── Configuração do ciclo ── */}
      <form action={salvarAction} className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Ciclo do rodízio</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Em cada semana do ciclo, defina a equipe da manhã e a da noite. Domingo
          cada uma cobre o seu turno; nos demais dias (inclusive eventos avulsos)
          as duas apoiam juntas.
        </p>

        <div className="mt-4 space-y-3">
          {semanas.map((_, i) => (
            <fieldset key={i} className="rounded-xl bg-zinc-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <legend className="text-sm font-semibold text-zinc-800">
                  Semana {i + 1} do ciclo
                </legend>
                {semanas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSemanas((s) => s.filter((_, j) => j !== i))}
                    className="text-xs font-medium text-zinc-500 underline hover:text-red-600"
                  >
                    Remover semana
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {selectEquipe(i, "manha", "Equipe da manhã", "manha")}
                {selectEquipe(i, "noite", "Equipe da noite", "noite")}
              </div>
            </fieldset>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSemanas((s) => [...s, { manha: "", noite: "" }])}
          className="mt-3 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          + Adicionar semana ao ciclo
        </button>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            Semana âncora (1ª semana do ciclo)
            <input
              type="date"
              name="semanaAncora"
              required
              defaultValue={ancoraInicial}
              className={inputCls}
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={ativoInicial}
              className="h-4 w-4 rounded border-zinc-300 accent-emerald-600"
            />
            Rodízio ativo (aplica automaticamente ao gerar eventos e criar avulsos)
          </label>
        </div>

        <button
          type="submit"
          disabled={pSalvar}
          className="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pSalvar ? "Salvando…" : "Salvar configuração"}
        </button>
      </form>

      {/* ── Aplicar num período ── */}
      <form action={aplicarAction} className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Aplicar rodízio</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Preenche as escalas dos eventos do período. Eventos com escala manual
          (ex.: conferência com equipes próprias) são preservados; pode reaplicar
          quantas vezes quiser.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            De
            <input type="date" name="inicio" required defaultValue={aplicarInicioPadrao} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            Até
            <input type="date" name="fim" required defaultValue={aplicarFimPadrao} className={inputCls} />
          </label>
          <button
            type="submit"
            disabled={pAplicar}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {pAplicar ? "Aplicando…" : "Aplicar rodízio"}
          </button>
        </div>
      </form>

      <FeedbackModal estado={estadoSalvar} />
      <FeedbackModal estado={estadoAplicar} />
    </div>
  );
}
