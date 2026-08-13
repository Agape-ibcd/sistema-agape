"use client";

import { useActionState, useState } from "react";
import { aprovarCandidaturaAction, reprovarCandidaturaAction } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";
import { Avatar } from "@/components/Avatar";
import { ROTULO_NIVEL } from "@/lib/rbac";
import type { NivelAcesso } from "@prisma/client";

export type CandidaturaDados = {
  id: string;
  nomeCompleto: string;
  email: string;
  celularWhatsapp: string;
  dataNascimento: string; // dd/mm/aaaa
  fotoUrl: string;
  membroDesde: string; // mm/aaaa
  fezCursoMnv: boolean;
  mnvConclusao: string | null; // mm/aaaa
  alunoEscolaBiblica: boolean;
  participaOutroMinisterio: boolean;
  quaisMinisterios: string | null;
  cultoDomingoManha: boolean;
  cultoDomingoNoite: boolean;
  disponibilidadeSemana: "regular" | "ocasional";
  status: "pendente" | "aprovado" | "reprovado";
  motivoReprovacao: string | null;
  convidadoPorNome: string;
  criadoEm: string; // dd/mm/aaaa
};

const NIVEIS: NivelAcesso[] = ["membro", "monitor", "lider", "admin", "super_admin"];
const inputCls =
  "w-full rounded-xl border border-edge px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";

export function CandidaturaCard({
  candidatura: c,
  equipes,
}: {
  candidatura: CandidaturaDados;
  equipes: { id: string; nome: string }[];
}) {
  const [estadoAprovar, acaoAprovar, pendenteAprovar] = useActionState(aprovarCandidaturaAction, null);
  const [estadoReprovar, acaoReprovar, pendenteReprovar] = useActionState(reprovarCandidaturaAction, null);
  const [modo, setModo] = useState<"aprovar" | "reprovar" | null>(null);
  const [nivelEscolhido, setNivelEscolhido] = useState<NivelAcesso>("membro");

  return (
    <div className="rounded-2xl border border-edge-soft vidro-leve p-5">
      <div className="flex items-start gap-3">
        <Avatar nome={c.nomeCompleto} fotoUrl={c.fotoUrl} tamanho={56} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{c.nomeCompleto}</p>
          <p className="text-xs text-ink-subtle">
            {c.email} · {c.celularWhatsapp}
          </p>
          <p className="mt-1 text-xs text-ink-subtle">
            Convidado(a) por <span className="font-medium text-ink">{c.convidadoPorNome}</span> · solicitado em {c.criadoEm}
          </p>
        </div>
        {c.status === "pendente" && (
          <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn-text">Pendente</span>
        )}
        {c.status === "aprovado" && (
          <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success-text">Aprovado</span>
        )}
        {c.status === "reprovado" && (
          <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger-text">Reprovado</span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-xl border border-edge-soft bg-surface-2 p-3 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-2">
          <dt className="text-ink-subtle">Nascimento</dt>
          <dd className="text-right font-medium text-ink">{c.dataNascimento}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-subtle">Membro da Igreja desde</dt>
          <dd className="text-right font-medium text-ink">{c.membroDesde}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-subtle">Curso MNV</dt>
          <dd className="text-right font-medium text-ink">
            {c.fezCursoMnv ? `Sim${c.mnvConclusao ? ` (concluído em ${c.mnvConclusao})` : ""}` : "Não"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-subtle">Escola Bíblica Casa de Deus</dt>
          <dd className="text-right font-medium text-ink">{c.alunoEscolaBiblica ? "Sim" : "Não"}</dd>
        </div>
        <div className="sm:col-span-2 flex justify-between gap-2">
          <dt className="text-ink-subtle">Outro(s) ministério(s)</dt>
          <dd className="text-right font-medium text-ink">
            {c.participaOutroMinisterio ? c.quaisMinisterios || "Sim" : "Não"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-subtle">Culto disponível</dt>
          <dd className="text-right font-medium text-ink">
            {[c.cultoDomingoManha && "Manhã", c.cultoDomingoNoite && "Noite"].filter(Boolean).join(" e ") || "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-subtle">Disponibilidade na semana</dt>
          <dd className="text-right font-medium text-ink">
            {c.disponibilidadeSemana === "regular" ? "Regular" : "Ocasional"}
          </dd>
        </div>
      </dl>

      {c.status === "reprovado" && c.motivoReprovacao && (
        <p className="mt-3 rounded-xl bg-danger-faint p-3 text-sm text-danger-text">
          Motivo: {c.motivoReprovacao}
        </p>
      )}

      {c.status === "pendente" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModo(modo === "aprovar" ? null : "aprovar")}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong"
          >
            Aprovar…
          </button>
          <button
            type="button"
            onClick={() => setModo(modo === "reprovar" ? null : "reprovar")}
            className="rounded-xl border border-edge px-4 py-2 text-sm font-medium text-ink-soft hover:border-danger-edge hover:bg-danger-faint hover:text-danger-text"
          >
            Reprovar…
          </button>
        </div>
      )}

      {modo === "aprovar" && (
        <form action={acaoAprovar} className="mt-3 space-y-2 rounded-xl bg-success-soft/40 p-3">
          <input type="hidden" name="candidaturaId" value={c.id} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
              Nível de acesso
              <select
                name="nivelAcesso"
                value={nivelEscolhido}
                onChange={(e) => setNivelEscolhido(e.target.value as NivelAcesso)}
                className={inputCls}
              >
                {NIVEIS.map((n) => (
                  <option key={n} value={n}>
                    {ROTULO_NIVEL[n]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
              Equipe
              <select name="equipeId" defaultValue="" disabled={nivelEscolhido === "monitor"} className={inputCls}>
                <option value="">Sem equipe</option>
                {equipes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={pendenteAprovar}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
          >
            {pendenteAprovar ? "Aprovando…" : "Confirmar aprovação"}
          </button>
        </form>
      )}

      {modo === "reprovar" && (
        <form action={acaoReprovar} className="mt-3 space-y-2 rounded-xl bg-danger-faint p-3">
          <input type="hidden" name="candidaturaId" value={c.id} />
          <textarea
            name="motivo"
            rows={2}
            maxLength={300}
            placeholder="Motivo da reprovação (opcional — vai por e-mail ao candidato)"
            className={inputCls}
          />
          <button
            type="submit"
            disabled={pendenteReprovar}
            className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white hover:bg-danger-strong disabled:opacity-60"
          >
            {pendenteReprovar ? "Aplicando…" : "Confirmar reprovação"}
          </button>
        </form>
      )}

      <FeedbackModal estado={estadoAprovar} />
      <FeedbackModal estado={estadoReprovar} />
    </div>
  );
}
