"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { criarEventoAvulso } from "../actions";
import { FeedbackModal } from "@/components/FeedbackModal";
import { calcularHorarioChegada } from "@/lib/recorrencia";

type Props = {
  tipos: { id: string; nome: string; horarioInicio: string }[];
};

type ValoresEvento = {
  tipoEventoId: string;
  dataEvento: string;
  horarioInicio: string;
  descricaoEspecifica: string;
};

export function EventoAvulsoForm({ tipos }: Props) {
  const router = useRouter();
  const [estado, formAction, pendente] = useActionState(criarEventoAvulso, null);
  const [horario, setHorario] = useState(tipos[0]?.horarioInicio ?? "19:30");
  // ts da pergunta "mesmo horário" já dispensada (mesmo padrão da propagação
  // de escalas): a pergunta some quando o usuário cancela ou reenvia.
  const [perguntaDispensada, setPerguntaDispensada] = useState<number | null>(null);
  // Valores capturados no submit — reenviados pelo form de confirmação (o
  // `useActionState` do React não serializa o name/value do botão que submete,
  // então a confirmação precisa reenviar tudo por hidden inputs próprios).
  const [ultimosValores, setUltimosValores] = useState<ValoresEvento | null>(null);

  const perguntaAberta =
    estado?.ok &&
    estado.confirmarMesmoHorario &&
    estado.ts !== perguntaDispensada;

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
        onSubmit={(e) => {
          // Guarda os valores para o form de confirmação poder reenviá-los.
          const fd = new FormData(e.currentTarget);
          setUltimosValores({
            tipoEventoId: String(fd.get("tipoEventoId") ?? ""),
            dataEvento: String(fd.get("dataEvento") ?? ""),
            horarioInicio: String(fd.get("horarioInicio") ?? ""),
            descricaoEspecifica: String(fd.get("descricaoEspecifica") ?? ""),
          });
        }}
        className="space-y-4 rounded-2xl border border-edge-soft vidro-leve p-5"
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

      {/* Já existe evento no MESMO dia e horário: confirma antes de criar.
          Form PRÓPRIO (fora do form principal) reenviando os valores por hidden
          inputs + confirmado=1 — o React não serializa o name/value do botão
          que submete, então a confirmação precisa carregar tudo explicitamente. */}
      {perguntaAberta && estado?.confirmarMesmoHorario && ultimosValores && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
        >
          <div className="vidro-forte w-full max-w-md rounded-2xl p-6">
            <h3 className="text-base font-semibold text-ink">
              Já existe evento neste dia e horário
            </h3>
            <p className="mt-2 text-sm text-ink-soft">
              Pode ser de propósito (por exemplo, dois eventos em locais
              diferentes). Conferir antes de criar:
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl bg-surface-2 p-3 text-sm text-ink-soft">
              {estado.confirmarMesmoHorario.rotulos.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <form action={formAction} className="flex-1">
                <input type="hidden" name="tipoEventoId" value={ultimosValores.tipoEventoId} />
                <input type="hidden" name="dataEvento" value={ultimosValores.dataEvento} />
                <input type="hidden" name="horarioInicio" value={ultimosValores.horarioInicio} />
                <input type="hidden" name="descricaoEspecifica" value={ultimosValores.descricaoEspecifica} />
                <input type="hidden" name="confirmado" value="1" />
                <button
                  type="submit"
                  disabled={pendente}
                  className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
                >
                  {pendente ? "Criando…" : "Sim, criar mesmo assim"}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setPerguntaDispensada(estado.ts)}
                className="flex-1 rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {!estado?.confirmarMesmoHorario && (
        <FeedbackModal
          estado={estado}
          onFechar={(e) => {
            if (e.ok) {
              const id = (e as { eventoId?: string }).eventoId;
              router.push(id ? `/eventos/${id}` : "/eventos");
            }
          }}
        />
      )}
    </>
  );
}
