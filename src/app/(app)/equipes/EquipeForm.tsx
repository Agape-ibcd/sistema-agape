"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { salvarEquipe } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";

export type EquipeFormDados = {
  id: string;
  nome: string;
  turnoPadrao: "manha" | "noite" | "variavel";
  corHex: string; // "" quando não definida
  status: "ativa" | "inativa";
};

const inputCls =
  "w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";
const labelCls = "mb-1 block text-sm font-medium text-ink-soft";

export function EquipeForm({ equipe }: { equipe: EquipeFormDados | null }) {
  const router = useRouter();
  const [estado, formAction, pendente] = useActionState(salvarEquipe, null);

  return (
    <>
      <form
        action={formAction}
        className="space-y-4 rounded-2xl border border-edge-soft bg-surface p-5"
      >
        {equipe && <input type="hidden" name="id" value={equipe.id} />}

        <div>
          <label htmlFor="nome" className={labelCls}>
            Nome da equipe *
          </label>
          <input
            id="nome"
            name="nome"
            required
            minLength={3}
            maxLength={150}
            defaultValue={equipe?.nome ?? ""}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="turnoPadrao" className={labelCls}>
              Turno padrão
            </label>
            <select
              id="turnoPadrao"
              name="turnoPadrao"
              defaultValue={equipe?.turnoPadrao ?? "variavel"}
              className={inputCls}
            >
              <option value="manha">Manhã</option>
              <option value="noite">Noite</option>
              <option value="variavel">Variável</option>
            </select>
          </div>

          <div>
            <label htmlFor="corHex" className={labelCls}>
              Cor no calendário
            </label>
            <input
              id="corHex"
              name="corHex"
              type="color"
              defaultValue={equipe?.corHex || "#059669"}
              className="h-11 w-full cursor-pointer rounded-xl border border-edge bg-surface px-1"
            />
          </div>

          <div>
            <label htmlFor="status" className={labelCls}>
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={equipe?.status ?? "ativa"}
              className={inputCls}
            >
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={pendente}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pendente ? "Salvando…" : equipe ? "Salvar alterações" : "Criar equipe"}
        </button>
      </form>

      <FeedbackModal
        estado={estado}
        onFechar={(e) => {
          if (e.ok && !equipe) {
            const id = (e as { equipeId?: string }).equipeId;
            router.push(id ? `/equipes/${id}` : "/equipes");
          }
        }}
      />
    </>
  );
}
