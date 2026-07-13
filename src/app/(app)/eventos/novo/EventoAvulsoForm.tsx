"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { criarEventoAvulso } from "../actions";
import { FeedbackModal } from "@/components/FeedbackModal";
import { calcularHorarioChegada } from "@/lib/recorrencia";

type Props = {
  tipos: { id: string; nome: string; horarioInicio: string }[];
};

export function EventoAvulsoForm({ tipos }: Props) {
  const router = useRouter();
  const [estado, formAction, pendente] = useActionState(criarEventoAvulso, null);
  const [horario, setHorario] = useState(tipos[0]?.horarioInicio ?? "19:30");

  const chegada = /^\d{1,2}:\d{2}$/.test(horario)
    ? calcularHorarioChegada(horario)
    : "—";

  const inputCls =
    "w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";
  const labelCls = "mb-1 block text-sm font-medium text-ink-soft";

  return (
    <>
      <form
        action={formAction}
        className="space-y-4 rounded-2xl border border-edge-soft bg-surface p-5"
      >
        <div>
          <label htmlFor="tipoEventoId" className={labelCls}>
            Tipo de evento *
          </label>
          <select
            id="tipoEventoId"
            name="tipoEventoId"
            required
            defaultValue={tipos[0]?.id ?? ""}
            onChange={(e) => {
              const tipo = tipos.find((t) => t.id === e.target.value);
              if (tipo) setHorario(tipo.horarioInicio);
            }}
            className={inputCls}
          >
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="dataEvento" className={labelCls}>
              Data *
            </label>
            <input id="dataEvento" name="dataEvento" type="date" required className={inputCls} />
          </div>
          <div>
            <label htmlFor="horarioInicio" className={labelCls}>
              Horário de início *
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
            <p className="mt-1 text-xs text-ink-subtle">
              Chegada da equipe:{" "}
              <span className="font-semibold text-brand-text">{chegada}</span>
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="descricaoEspecifica" className={labelCls}>
            Descrição do evento
          </label>
          <input
            id="descricaoEspecifica"
            name="descricaoEspecifica"
            maxLength={200}
            placeholder="Ex.: Conferência de Jovens — noite 1"
            className={inputCls}
          />
        </div>

        <button
          type="submit"
          disabled={pendente}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pendente ? "Criando…" : "Criar evento"}
        </button>
      </form>

      <FeedbackModal
        estado={estado}
        onFechar={(e) => {
          if (e.ok) {
            const id = (e as { eventoId?: string }).eventoId;
            router.push(id ? `/eventos/${id}` : "/eventos");
          }
        }}
      />
    </>
  );
}
