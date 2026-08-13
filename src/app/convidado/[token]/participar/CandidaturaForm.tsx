"use client";

import { useActionState, useState } from "react";
import { enviarCandidatura } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";
import { prepararFotoInput } from "@/lib/fotoCliente";

const inputCls =
  "w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";
const labelCls = "mb-1 block text-sm font-medium text-ink-soft";
const checkboxRowCls = "flex items-center gap-2 text-sm text-ink";

export function CandidaturaForm({ token }: { token: string }) {
  const [estado, formAction, pendente] = useActionState(enviarCandidatura, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [fezCursoMnv, setFezCursoMnv] = useState(false);
  const [participaOutroMinisterio, setParticipaOutroMinisterio] = useState(false);

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    setErroFoto(null);
    try {
      const url = await prepararFotoInput(e);
      if (url) setPreview(url);
    } catch (erro) {
      e.target.value = "";
      setErroFoto(erro instanceof Error ? erro.message : "Não foi possível ler a imagem.");
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {/* Foto */}
      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local
          <img src={preview} alt="Pré-visualização" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs text-ink-subtle">
            Foto
          </span>
        )}
        <div className="flex-1">
          <label htmlFor="foto" className={labelCls}>
            Foto (JPG/PNG — obrigatória) *
          </label>
          <input
            id="foto"
            name="foto"
            type="file"
            required
            accept="image/jpeg,image/png"
            onChange={aoEscolherFoto}
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-brand-faint file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-text hover:file:bg-brand-soft"
          />
          {erroFoto && <p className="mt-1 text-xs text-danger-text">{erroFoto}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="nomeCompleto" className={labelCls}>Nome completo *</label>
          <input id="nomeCompleto" name="nomeCompleto" required minLength={3} maxLength={200} className={inputCls} />
        </div>
        <div>
          <label htmlFor="email" className={labelCls}>E-mail *</label>
          <input id="email" name="email" type="email" required maxLength={150} className={inputCls} />
        </div>
        <div>
          <label htmlFor="celularWhatsapp" className={labelCls}>Celular (WhatsApp) *</label>
          <input id="celularWhatsapp" name="celularWhatsapp" type="tel" required maxLength={20} placeholder="(11) 99999-9999" className={inputCls} />
        </div>
        <div>
          <label htmlFor="dataNascimento" className={labelCls}>Data de nascimento *</label>
          <input id="dataNascimento" name="dataNascimento" type="date" required className={inputCls} />
        </div>
        <div>
          <label htmlFor="membroDesde" className={labelCls}>Membro da Igreja desde (mês/ano) *</label>
          <input id="membroDesde" name="membroDesde" type="month" required className={inputCls} />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-edge-soft bg-surface-2 p-4">
        <label className={checkboxRowCls}>
          <input
            type="checkbox"
            name="fezCursoMnv"
            checked={fezCursoMnv}
            onChange={(e) => setFezCursoMnv(e.target.checked)}
            className="h-4 w-4 rounded border-edge"
          />
          Você já participou do curso MNV (Mergulhando numa Nova Vida)?
        </label>
        {fezCursoMnv && (
          <div className="pl-6">
            <label htmlFor="mnvConclusao" className={labelCls}>Mês/ano de conclusão do MNV *</label>
            <input id="mnvConclusao" name="mnvConclusao" type="month" required={fezCursoMnv} className={`${inputCls} max-w-xs`} />
          </div>
        )}

        <label className={checkboxRowCls}>
          <input type="checkbox" name="alunoEscolaBiblica" className="h-4 w-4 rounded border-edge" />
          Você é aluno da Escola Bíblica Casa de Deus?
        </label>

        <label className={checkboxRowCls}>
          <input
            type="checkbox"
            name="participaOutroMinisterio"
            checked={participaOutroMinisterio}
            onChange={(e) => setParticipaOutroMinisterio(e.target.checked)}
            className="h-4 w-4 rounded border-edge"
          />
          Você participa de outros Ministérios da Igreja?
        </label>
        {participaOutroMinisterio && (
          <div className="pl-6">
            <label htmlFor="quaisMinisterios" className={labelCls}>Quais Ministérios você participa? *</label>
            <input
              id="quaisMinisterios"
              name="quaisMinisterios"
              required={participaOutroMinisterio}
              maxLength={300}
              className={inputCls}
            />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={pendente}
        className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
      >
        {pendente ? "Enviando…" : "Enviar candidatura"}
      </button>

      <FeedbackModal estado={estado} />
    </form>
  );
}
