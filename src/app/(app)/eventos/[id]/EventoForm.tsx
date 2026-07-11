"use client";

import { useState, useActionState } from "react";
import { salvarEvento, alternarStatusEvento } from "../actions";
import { FeedbackModal } from "@/components/FeedbackModal";
import { calcularHorarioChegada } from "@/lib/recorrencia";

type Props = {
  evento: {
    id: string;
    horarioInicio: string;
    descricaoEspecifica: string;
    status: "agendado" | "realizado" | "cancelado";
  };
};

export function EventoForm({ evento }: Props) {
  const [estado, formAction, pendente] = useActionState(salvarEvento, null);
  const [estadoStatus, statusAction, pStatus] = useActionState(alternarStatusEvento, null);
  const [horario, setHorario] = useState(evento.horarioInicio);

  const chegada = /^\d{1,2}:\d{2}$/.test(horario)
    ? calcularHorarioChegada(horario)
    : "—";

  const inputCls =
    "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold text-zinc-900">Dados do evento</h2>

      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="id" value={evento.id} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="horarioInicio" className="mb-1 block text-sm font-medium text-zinc-700">
              Horário de início
            </label>
            <input
              id="horarioInicio"
              name="horarioInicio"
              type="time"
              required
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Chegada da equipe:{" "}
              <span className="font-semibold text-emerald-700">{chegada}</span>
            </p>
          </div>
          <div>
            <label
              htmlFor="descricaoEspecifica"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Descrição específica
            </label>
            <input
              id="descricaoEspecifica"
              name="descricaoEspecifica"
              maxLength={200}
              defaultValue={evento.descricaoEspecifica}
              placeholder="Ex.: Culto de batismo"
              className={inputCls}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pendente || evento.status === "cancelado"}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pendente ? "Salvando…" : "Salvar alterações"}
        </button>
      </form>

      {evento.status !== "realizado" && (
        <form
          action={statusAction}
          onSubmit={(e) => {
            const msg =
              evento.status === "cancelado"
                ? "Reativar este evento?"
                : "Cancelar este evento? Ele permanece no histórico e pode ser reativado.";
            if (!window.confirm(msg)) e.preventDefault();
          }}
          className="mt-4 border-t border-zinc-100 pt-4"
        >
          <input type="hidden" name="id" value={evento.id} />
          <button
            type="submit"
            disabled={pStatus}
            className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
              evento.status === "cancelado"
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "border border-red-300 text-red-700 hover:bg-red-50"
            }`}
          >
            {pStatus
              ? "Aplicando…"
              : evento.status === "cancelado"
                ? "Reativar evento"
                : "Cancelar evento"}
          </button>
        </form>
      )}

      <FeedbackModal estado={estado} />
      <FeedbackModal estado={estadoStatus} />
    </section>
  );
}
