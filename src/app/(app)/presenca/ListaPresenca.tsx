"use client";

import { useState, useActionState } from "react";
import { salvarPresenca, excluirPresenca, restaurarPresenca } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";

// Lançamento ativo (não excluído) de um membro.
export type LancamentoAtivo = {
  id: string;
  presente: boolean;
  pontualidade: "pontual" | "atrasado" | null;
  horarioChegada: string | null;
  justificativaAusencia: string | null;
};

// Lançamento excluído (mostrado riscado, com botão restaurar).
export type LancamentoExcluido = {
  id: string;
  presente: boolean;
  pontualidade: "pontual" | "atrasado" | null;
  motivoExclusao: string | null;
};

export type MembroLinha = {
  id: string;
  nome: string;
  ativo: LancamentoAtivo | null;
  excluido: LancamentoExcluido | null;
};

type Props = {
  eventoId: string;
  equipeId: string;
  horarioChegadaSugerido: string;
  membros: MembroLinha[];
};

export function ListaPresenca({
  eventoId,
  equipeId,
  horarioChegadaSugerido,
  membros,
}: Props) {
  // Ações compartilhadas: um FeedbackModal por tipo de operação.
  const [estadoSalvar, salvarAction] = useActionState(salvarPresenca, null);
  const [estadoExcluir, excluirAction] = useActionState(excluirPresenca, null);
  const [estadoRestaurar, restaurarAction] = useActionState(
    restaurarPresenca,
    null,
  );

  const totalLancados = membros.filter((m) => m.ativo).length;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900">
          Presença da equipe
        </h2>
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
          {totalLancados} de {membros.length} lançados
        </span>
      </div>

      {membros.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          Nenhum membro ativo nesta equipe.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {membros.map((m) => (
            <LinhaPresenca
              key={m.id}
              membro={m}
              eventoId={eventoId}
              equipeId={equipeId}
              horarioChegadaSugerido={horarioChegadaSugerido}
              salvarAction={salvarAction}
              excluirAction={excluirAction}
              restaurarAction={restaurarAction}
            />
          ))}
        </ul>
      )}

      <FeedbackModal estado={estadoSalvar} />
      <FeedbackModal estado={estadoExcluir} />
      <FeedbackModal estado={estadoRestaurar} />
    </section>
  );
}

function LinhaPresenca({
  membro,
  eventoId,
  equipeId,
  horarioChegadaSugerido,
  salvarAction,
  excluirAction,
  restaurarAction,
}: {
  membro: MembroLinha;
  eventoId: string;
  equipeId: string;
  horarioChegadaSugerido: string;
  salvarAction: (formData: FormData) => void;
  excluirAction: (formData: FormData) => void;
  restaurarAction: (formData: FormData) => void;
}) {
  const { ativo, excluido } = membro;

  // Estado local do formulário (inicia a partir do lançamento ativo, se houver).
  const [presente, setPresente] = useState<boolean>(ativo ? ativo.presente : true);
  const [pontualidade, setPontualidade] = useState<"pontual" | "atrasado">(
    ativo?.pontualidade ?? "pontual",
  );
  const [horario, setHorario] = useState<string>(
    ativo?.horarioChegada ?? horarioChegadaSugerido,
  );
  const [justificativa, setJustificativa] = useState<string>(
    ativo?.justificativaAusencia ?? "",
  );
  const [excluindo, setExcluindo] = useState(false);
  const [motivo, setMotivo] = useState("");

  const inputCls =
    "rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

  const toggleBtn = (ativoEstado: boolean, cor: "emerald" | "amber") =>
    ativoEstado
      ? cor === "emerald"
        ? "bg-emerald-600 text-white border-emerald-600"
        : "bg-amber-500 text-white border-amber-500"
      : "bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50";

  // Lançamento excluído (e sem lançamento ativo): mostra riscado + restaurar.
  if (excluido && !ativo) {
    return (
      <li className="py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-500 line-through">
              {membro.nome}
            </p>
            <p className="text-xs text-red-600">
              Excluído
              {excluido.motivoExclusao ? ` · ${excluido.motivoExclusao}` : ""}
            </p>
          </div>
          <form
            action={restaurarAction}
            onSubmit={(ev) => {
              if (!window.confirm(`Restaurar o lançamento de ${membro.nome}?`))
                ev.preventDefault();
            }}
          >
            <input type="hidden" name="presencaId" value={excluido.id} />
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              Restaurar
            </button>
          </form>
        </div>
      </li>
    );
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-900">{membro.nome}</p>
        {ativo && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              ativo.presente
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {ativo.presente
              ? `Presente · ${ativo.pontualidade === "atrasado" ? "atrasado" : "pontual"}`
              : "Ausente"}
          </span>
        )}
      </div>

      <form action={salvarAction} className="mt-2 space-y-2">
        <input type="hidden" name="eventoId" value={eventoId} />
        <input type="hidden" name="equipeId" value={equipeId} />
        <input type="hidden" name="membroId" value={membro.id} />
        <input type="hidden" name="presente" value={presente ? "true" : "false"} />
        <input type="hidden" name="pontualidade" value={pontualidade} />

        {/* Presente / Ausente */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPresente(true)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${toggleBtn(presente, "emerald")}`}
          >
            Presente
          </button>
          <button
            type="button"
            onClick={() => setPresente(false)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${toggleBtn(!presente, "amber")}`}
          >
            Ausente
          </button>
        </div>

        {presente ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-zinc-300">
              <button
                type="button"
                onClick={() => setPontualidade("pontual")}
                className={`px-3 py-2 text-sm font-medium ${pontualidade === "pontual" ? "bg-emerald-600 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
              >
                Pontual
              </button>
              <button
                type="button"
                onClick={() => setPontualidade("atrasado")}
                className={`px-3 py-2 text-sm font-medium ${pontualidade === "atrasado" ? "bg-amber-500 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
              >
                Atrasado
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-zinc-500">
              Chegada
              <input
                type="time"
                name="horarioChegada"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                className={`${inputCls} w-28`}
              />
            </label>
          </div>
        ) : (
          <input
            name="justificativa"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            maxLength={500}
            placeholder="Justificativa da ausência (opcional)"
            className={`${inputCls} w-full`}
          />
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {ativo ? "Atualizar" : "Salvar"}
          </button>
          {ativo && !excluindo && (
            <button
              type="button"
              onClick={() => setExcluindo(true)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            >
              Excluir
            </button>
          )}
        </div>
      </form>

      {/* Exclusão: motivo obrigatório + confirmação nativa antes de enviar. */}
      {ativo && excluindo && (
        <form
          action={excluirAction}
          onSubmit={(ev) => {
            if (
              !window.confirm(
                `Excluir o lançamento de ${membro.nome}? Ele poderá ser restaurado depois.`,
              )
            )
              ev.preventDefault();
          }}
          className="mt-2 space-y-2 rounded-lg bg-red-50 p-3"
        >
          <input type="hidden" name="presencaId" value={ativo.id} />
          <input
            name="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            required
            maxLength={500}
            placeholder="Motivo da exclusão (obrigatório)"
            className={`${inputCls} w-full`}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={motivo.trim().length === 0}
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              Confirmar exclusão
            </button>
            <button
              type="button"
              onClick={() => {
                setExcluindo(false);
                setMotivo("");
              }}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
