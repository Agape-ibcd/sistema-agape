"use client";

import { useActionState, useRef } from "react";
import {
  adicionarLider,
  removerLider,
  adicionarMembroEquipe,
  removerMembroEquipe,
} from "../actions";
import { FeedbackModal } from "@/components/FeedbackModal";
import { Avatar } from "@/components/Avatar";

type Pessoa = {
  id: string;
  nomeCompleto: string;
  fotoUrl: string | null;
  equipeNome: string | null; // equipe atual (para avisar sobre mover)
};

type Lider = {
  vinculoId: string;
  membroId: string;
  nomeCompleto: string;
  fotoUrl: string | null;
  desde: string; // já formatada pt-BR
};

type Props = {
  equipeId: string;
  lideres: Lider[];
  membrosDaEquipe: Pessoa[];
  // Candidatos: membros ativos fora desta equipe (para adicionar) e todos os
  // ativos (para liderança — um líder pode não pertencer à equipe).
  candidatosMembro: Pessoa[];
  candidatosLider: Pessoa[];
};

const selectCls =
  "min-w-0 flex-1 rounded-xl border border-edge px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";
const addBtnCls =
  "rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60";
const removeBtnCls =
  "rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-danger-edge hover:bg-danger-faint hover:text-danger-text disabled:opacity-60";

export function GerirEquipe({
  equipeId,
  lideres,
  membrosDaEquipe,
  candidatosMembro,
  candidatosLider,
}: Props) {
  const [estadoAddLider, addLiderAction, pAddLider] = useActionState(adicionarLider, null);
  const [estadoRmLider, rmLiderAction, pRmLider] = useActionState(removerLider, null);
  const [estadoAddMembro, addMembroAction, pAddMembro] = useActionState(
    adicionarMembroEquipe,
    null,
  );
  const [estadoRmMembro, rmMembroAction, pRmMembro] = useActionState(
    removerMembroEquipe,
    null,
  );

  const selMembroRef = useRef<HTMLSelectElement>(null);

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Líderes */}
      <section className="rounded-2xl border border-edge-soft vidro-leve p-5">
        <h2 className="text-base font-semibold text-ink">Líderes</h2>
        <p className="mt-0.5 text-xs text-ink-subtle">
          Ao encerrar uma liderança o histórico é preservado (data de fim).
        </p>

        <ul className="mt-3 divide-y divide-edge-soft">
          {lideres.length === 0 && (
            <li className="py-3 text-sm text-ink-subtle">Nenhum líder ativo.</li>
          )}
          {lideres.map((l) => (
            <li key={l.vinculoId} className="flex items-center gap-3 py-2.5">
              <Avatar nome={l.nomeCompleto} fotoUrl={l.fotoUrl} tamanho={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {l.nomeCompleto}
                </p>
                <p className="text-xs text-ink-subtle">Líder desde {l.desde}</p>
              </div>
              <form
                action={rmLiderAction}
                onSubmit={(e) => {
                  if (!window.confirm(`Encerrar a liderança de ${l.nomeCompleto}?`))
                    e.preventDefault();
                }}
              >
                <input type="hidden" name="vinculoId" value={l.vinculoId} />
                <button type="submit" disabled={pRmLider} className={removeBtnCls}>
                  Encerrar
                </button>
              </form>
            </li>
          ))}
        </ul>

        <form action={addLiderAction} className="mt-3 flex items-center gap-2">
          <input type="hidden" name="equipeId" value={equipeId} />
          <select name="membroId" required defaultValue="" className={selectCls}>
            <option value="" disabled>
              Adicionar líder…
            </option>
            {candidatosLider.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nomeCompleto}
              </option>
            ))}
          </select>
          <button type="submit" disabled={pAddLider} className={addBtnCls}>
            Adicionar
          </button>
        </form>
      </section>

      {/* Membros */}
      <section className="rounded-2xl border border-edge-soft vidro-leve p-5">
        <h2 className="text-base font-semibold text-ink">
          Membros ({membrosDaEquipe.length})
        </h2>
        <p className="mt-0.5 text-xs text-ink-subtle">
          Cada membro pertence a uma única equipe ativa por vez.
        </p>

        <ul className="mt-3 divide-y divide-edge-soft">
          {membrosDaEquipe.length === 0 && (
            <li className="py-3 text-sm text-ink-subtle">Nenhum membro na equipe.</li>
          )}
          {membrosDaEquipe.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <Avatar nome={m.nomeCompleto} fotoUrl={m.fotoUrl} tamanho={36} />
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {m.nomeCompleto}
              </p>
              <form
                action={rmMembroAction}
                onSubmit={(e) => {
                  if (
                    !window.confirm(
                      `Remover ${m.nomeCompleto} da equipe? O membro fica "sem equipe" e o histórico de presenças é preservado.`,
                    )
                  )
                    e.preventDefault();
                }}
              >
                <input type="hidden" name="equipeId" value={equipeId} />
                <input type="hidden" name="membroId" value={m.id} />
                <button type="submit" disabled={pRmMembro} className={removeBtnCls}>
                  Remover
                </button>
              </form>
            </li>
          ))}
        </ul>

        <form
          action={addMembroAction}
          onSubmit={(e) => {
            const sel = selMembroRef.current;
            const opt = sel?.selectedOptions[0];
            const equipeAtual = opt?.dataset.equipe;
            if (
              equipeAtual &&
              !window.confirm(
                `${opt.text} já pertence à equipe "${equipeAtual}". Mover para esta equipe? (Um membro tem apenas uma equipe ativa por vez.)`,
              )
            ) {
              e.preventDefault();
            }
          }}
          className="mt-3 flex items-center gap-2"
        >
          <input type="hidden" name="equipeId" value={equipeId} />
          <select
            ref={selMembroRef}
            name="membroId"
            required
            defaultValue=""
            className={selectCls}
          >
            <option value="" disabled>
              Adicionar membro…
            </option>
            {candidatosMembro.map((p) => (
              <option key={p.id} value={p.id} data-equipe={p.equipeNome ?? undefined}>
                {p.nomeCompleto}
                {p.equipeNome ? ` — ${p.equipeNome}` : ""}
              </option>
            ))}
          </select>
          <button type="submit" disabled={pAddMembro} className={addBtnCls}>
            Adicionar
          </button>
        </form>
      </section>

      <FeedbackModal estado={estadoAddLider} />
      <FeedbackModal estado={estadoRmLider} />
      <FeedbackModal estado={estadoAddMembro} />
      <FeedbackModal estado={estadoRmMembro} />
    </div>
  );
}
