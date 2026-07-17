"use client";

import { useActionState } from "react";
import type { NivelAcesso, CanalNotificacao } from "@prisma/client";
import { salvarConfigNotificacao } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";

const ROTULO_NIVEL: Record<NivelAcesso, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  monitor: "Monitor",
  lider: "Líder",
  membro: "Membro",
};
const NIVEIS: NivelAcesso[] = ["super_admin", "admin", "monitor", "lider", "membro"];

export type RegraDados = {
  id: string;
  titulo: string;
  descricao: string;
  implementado: boolean;
  ativo: boolean;
  niveisAlvo: NivelAcesso[];
  canais: CanalNotificacao[];
  assunto: string | null;
  mensagem: string | null;
  horarioEnvio: string | null;
  usaHorario: boolean;
};

const inputCls =
  "w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";
const labelCls = "mb-1 block text-sm font-medium text-ink-soft";

export function RegraNotificacaoForm({ regra }: { regra: RegraDados }) {
  const [estado, formAction, pendente] = useActionState(salvarConfigNotificacao, null);

  return (
    <>
      <form
        action={formAction}
        className="space-y-4 rounded-2xl border border-edge-soft bg-surface p-5"
      >
        <input type="hidden" name="id" value={regra.id} />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-ink">{regra.titulo}</h3>
              {!regra.implementado && (
                <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn-text">
                  Em breve
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-ink-subtle">{regra.descricao}</p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-ink-soft">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={regra.ativo}
              className="accent-brand"
            />
            Ativa
          </label>
        </div>

        <div>
          <p className={labelCls}>Enviar para (nível de acesso)</p>
          <div className="flex flex-wrap gap-2">
            {NIVEIS.map((n) => (
              <label
                key={n}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-edge-soft px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-faint"
              >
                <input
                  type="checkbox"
                  name="niveisAlvo"
                  value={n}
                  defaultChecked={regra.niveisAlvo.includes(n)}
                  className="accent-brand"
                />
                {ROTULO_NIVEL[n]}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-subtle">
            Nenhum marcado = envia para todos os níveis.
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              name="canalEmail"
              defaultChecked={regra.canais.includes("email")}
              className="accent-brand"
            />
            E-mail
          </label>
          <label
            className="flex cursor-not-allowed items-center gap-2 text-sm text-ink-faint"
            title="Chega na próxima rodada (Telegram Bot)"
          >
            <input type="checkbox" disabled className="accent-brand" />
            Telegram (em breve)
          </label>
        </div>

        {regra.usaHorario && (
          <div className="max-w-xs">
            <label htmlFor={`horario-${regra.id}`} className={labelCls}>
              Horário de envio
            </label>
            <input
              id={`horario-${regra.id}`}
              name="horarioEnvio"
              type="time"
              defaultValue={regra.horarioEnvio ?? ""}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-ink-subtle">
              {regra.implementado
                ? "O sistema confere a cada poucos minutos e dispara assim que bater esse horário (não repete no mesmo dia)."
                : "Só vale quando o envio deste gatilho for implementado."}
            </p>
          </div>
        )}

        <div>
          <label htmlFor={`assunto-${regra.id}`} className={labelCls}>
            Assunto do e-mail
          </label>
          <input
            id={`assunto-${regra.id}`}
            name="assunto"
            defaultValue={regra.assunto ?? ""}
            maxLength={200}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor={`mensagem-${regra.id}`} className={labelCls}>
            Mensagem
          </label>
          <textarea
            id={`mensagem-${regra.id}`}
            name="mensagem"
            rows={4}
            defaultValue={regra.mensagem ?? ""}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-ink-subtle">
            Use <code>{"{{nome}}"}</code> para o primeiro nome do destinatário.
          </p>
        </div>

        <button
          type="submit"
          disabled={pendente}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pendente ? "Salvando…" : "Salvar regra"}
        </button>
      </form>
      <FeedbackModal estado={estado} />
    </>
  );
}
