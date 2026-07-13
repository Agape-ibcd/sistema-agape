"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import type { TipoRecorrencia } from "@prisma/client";
import { salvarTipoEvento } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";
import {
  DIAS_SEMANA,
  DIAS_SEMANA_CURTO,
  calcularHorarioChegada,
  type ConfigRecorrencia,
} from "@/lib/recorrencia";

export type TipoEventoFormDados = {
  id: string;
  nome: string;
  descricao: string;
  horarioInicio: string;
  categoria: string;
  tipoRecorrencia: TipoRecorrencia;
  config: ConfigRecorrencia;
  ativo: boolean;
};

// Seletor visual dos 7 modos de recorrência: cartões clicáveis + campos
// condicionais do modo escolhido.
const MODOS: { valor: TipoRecorrencia; titulo: string; exemplo: string }[] = [
  { valor: "semanal", titulo: "Semanal", exemplo: "Ex.: todo domingo e quarta" },
  { valor: "quinzenal", titulo: "Quinzenal", exemplo: "Ex.: sábado sim, sábado não" },
  { valor: "mensal_dia_fixo", titulo: "Mensal · dia fixo", exemplo: "Ex.: todo dia 15" },
  { valor: "mensal_posicao", titulo: "Mensal · posição", exemplo: "Ex.: 1ª terça do mês" },
  {
    valor: "mensal_ultima_posicao",
    titulo: "Mensal · última posição",
    exemplo: "Ex.: último domingo do mês",
  },
  { valor: "diario", titulo: "Diário", exemplo: "Todos os dias (campanhas)" },
  { valor: "avulso", titulo: "Avulso", exemplo: "Sem recorrência — data única" },
];

const CATEGORIAS = [
  ["culto_regular", "Culto regular"],
  ["evento_extra", "Evento extra"],
  ["campanha", "Campanha"],
  ["conferencia", "Conferência"],
  ["batismo", "Batismo"],
  ["outro", "Outro"],
] as const;

const inputCls =
  "w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";
const labelCls = "mb-1 block text-sm font-medium text-ink-soft";

export function TipoEventoForm({ tipo }: { tipo: TipoEventoFormDados | null }) {
  const router = useRouter();
  const [estado, formAction, pendente] = useActionState(salvarTipoEvento, null);
  const [modo, setModo] = useState<TipoRecorrencia>(tipo?.tipoRecorrencia ?? "semanal");
  const [horario, setHorario] = useState(tipo?.horarioInicio ?? "19:00");

  const chegada = /^\d{1,2}:\d{2}$/.test(horario)
    ? calcularHorarioChegada(horario)
    : "—";

  return (
    <>
      <form
        action={formAction}
        className="space-y-5 rounded-2xl border border-edge-soft bg-surface p-5"
      >
        {tipo && <input type="hidden" name="id" value={tipo.id} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="nome" className={labelCls}>
              Nome *
            </label>
            <input
              id="nome"
              name="nome"
              required
              minLength={3}
              maxLength={150}
              defaultValue={tipo?.nome ?? ""}
              placeholder="Ex.: Domingo Manhã"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="categoria" className={labelCls}>
              Categoria
            </label>
            <select
              id="categoria"
              name="categoria"
              defaultValue={tipo?.categoria ?? "culto_regular"}
              className={inputCls}
            >
              {CATEGORIAS.map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
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
              Chegada da equipe (início − 1h15):{" "}
              <span className="font-semibold text-brand-text">{chegada}</span>
            </p>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="descricao" className={labelCls}>
              Descrição
            </label>
            <textarea
              id="descricao"
              name="descricao"
              rows={2}
              defaultValue={tipo?.descricao ?? ""}
              className={inputCls}
            />
          </div>
        </div>

        {/* Seletor visual de recorrência */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-soft">
            Recorrência *
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {MODOS.map((m) => (
              <label
                key={m.valor}
                className={`cursor-pointer rounded-xl border p-3 transition ${
                  modo === m.valor
                    ? "border-brand bg-brand-faint ring-2 ring-brand-ring"
                    : "border-edge-soft hover:border-edge"
                }`}
              >
                <input
                  type="radio"
                  name="tipoRecorrencia"
                  value={m.valor}
                  checked={modo === m.valor}
                  onChange={() => setModo(m.valor)}
                  className="sr-only"
                />
                <p className="text-sm font-semibold text-ink">{m.titulo}</p>
                <p className="mt-0.5 text-xs text-ink-subtle">{m.exemplo}</p>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Campos condicionais do modo escolhido */}
        {modo === "semanal" && (
          <div>
            <p className={labelCls}>Dias da semana *</p>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA_CURTO.map((rotulo, dia) => (
                <label
                  key={dia}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-edge-soft px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-faint"
                >
                  <input
                    type="checkbox"
                    name="diasSemana"
                    value={dia}
                    defaultChecked={tipo?.config.diasSemana?.includes(dia) ?? false}
                    className="accent-brand"
                  />
                  {rotulo}
                </label>
              ))}
            </div>
          </div>
        )}

        {modo === "quinzenal" && (
          <div className="max-w-xs">
            <label htmlFor="dataBase" className={labelCls}>
              Data da primeira ocorrência *
            </label>
            <input
              id="dataBase"
              name="dataBase"
              type="date"
              required
              defaultValue={tipo?.config.dataBase ?? ""}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-ink-subtle">
              Repete a cada 14 dias a partir desta data.
            </p>
          </div>
        )}

        {modo === "mensal_dia_fixo" && (
          <div className="max-w-xs">
            <label htmlFor="diaMes" className={labelCls}>
              Dia do mês (1–31) *
            </label>
            <input
              id="diaMes"
              name="diaMes"
              type="number"
              min={1}
              max={31}
              required
              defaultValue={tipo?.config.dia ?? ""}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-ink-subtle">
              Em meses mais curtos, cai no último dia do mês.
            </p>
          </div>
        )}

        {(modo === "mensal_posicao" || modo === "mensal_ultima_posicao") && (
          <div className="flex flex-wrap gap-4">
            {modo === "mensal_posicao" && (
              <div>
                <label htmlFor="posicao" className={labelCls}>
                  Posição no mês *
                </label>
                <select
                  id="posicao"
                  name="posicao"
                  required
                  defaultValue={tipo?.config.posicao ?? 1}
                  className={inputCls}
                >
                  <option value={1}>1ª</option>
                  <option value={2}>2ª</option>
                  <option value={3}>3ª</option>
                  <option value={4}>4ª</option>
                </select>
              </div>
            )}
            <div>
              <label htmlFor="diaSemana" className={labelCls}>
                Dia da semana *
              </label>
              <select
                id="diaSemana"
                name="diaSemana"
                required
                defaultValue={tipo?.config.diaSemana ?? 0}
                className={inputCls}
              >
                {DIAS_SEMANA.map((rotulo, dia) => (
                  <option key={dia} value={dia}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </div>
            {modo === "mensal_ultima_posicao" && (
              <p className="self-end pb-3 text-xs text-ink-subtle">
                Ex.: último domingo do mês (batismo).
              </p>
            )}
          </div>
        )}

        {modo === "avulso" && (
          <p className="rounded-xl bg-surface-2 p-3 text-xs text-ink-soft">
            Tipos avulsos não geram instâncias automáticas — crie cada evento
            manualmente pelo calendário (&quot;Novo evento avulso&quot;).
          </p>
        )}

        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="ativo"
            defaultChecked={tipo?.ativo ?? true}
            className="accent-brand"
          />
          Tipo ativo (aparece na geração automática e em novos eventos)
        </label>

        <button
          type="submit"
          disabled={pendente}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pendente ? "Salvando…" : tipo ? "Salvar alterações" : "Criar tipo de evento"}
        </button>
      </form>

      <FeedbackModal
        estado={estado}
        onFechar={(e) => {
          if (e.ok && !tipo) router.push("/eventos/tipos");
        }}
      />
    </>
  );
}
