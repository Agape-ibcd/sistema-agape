"use client";

import { useActionState } from "react";
import { atualizarPerfil } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";

type Props = {
  celular: string;
  observacao: string;
};

export function PerfilForm({ celular, observacao }: Props) {
  const [estado, formAction, pendente] = useActionState(atualizarPerfil, null);

  return (
    <>
      <form
        action={formAction}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5"
      >
        <div>
          <label
            htmlFor="celular"
            className="mb-1 block text-sm font-medium text-zinc-700"
          >
            Celular (WhatsApp)
          </label>
          <input
            id="celular"
            name="celular"
            type="tel"
            defaultValue={celular}
            maxLength={20}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            placeholder="(11) 99999-9999"
          />
        </div>

        <div>
          <label
            htmlFor="observacao"
            className="mb-1 block text-sm font-medium text-zinc-700"
          >
            Observação
          </label>
          <textarea
            id="observacao"
            name="observacao"
            defaultValue={observacao}
            rows={3}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            placeholder="Alguma observação sobre você"
          />
        </div>

        <button
          type="submit"
          disabled={pendente}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pendente ? "Salvando…" : "Salvar alterações"}
        </button>
      </form>

      <FeedbackModal estado={estado} />
    </>
  );
}
