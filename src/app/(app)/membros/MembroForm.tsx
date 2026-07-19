"use client";

import { useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { salvarMembro, removerFoto, definirStatusMembro } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";
import { Avatar } from "@/components/Avatar";
import { prepararFotoInput } from "@/lib/fotoCliente";

export type MembroFormDados = {
  id: string;
  nomeCompleto: string;
  email: string;
  celular: string;
  dataNascimento: string; // "YYYY-MM-DD" ou ""
  equipeId: string;
  observacao: string;
  fotoUrl: string | null;
  status: "ativo" | "afastado" | "inativo";
  motivoStatus: string;
  retornoPrevisto: string; // "YYYY-MM-DD" ou ""
};

type Props = {
  membro: MembroFormDados | null; // null = cadastro novo
  equipes: { id: string; nome: string }[];
};

const inputCls =
  "w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";
const labelCls = "mb-1 block text-sm font-medium text-ink-soft";

export function MembroForm({ membro, equipes }: Props) {
  const router = useRouter();
  const [estado, formAction, pendente] = useActionState(salvarMembro, null);
  const [estadoFoto, acaoRemoverFoto, pendenteFoto] = useActionState(removerFoto, null);
  const [estadoStatus, acaoStatus, pendenteStatus] = useActionState(
    definirStatusMembro,
    null,
  );

  const [preview, setPreview] = useState<string | null>(membro?.fotoUrl ?? null);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    setErroFoto(null);
    try {
      const url = await prepararFotoInput(e);
      if (url) setPreview(url);
    } catch (erro) {
      e.target.value = "";
      setErroFoto(
        erro instanceof Error ? erro.message : "Não foi possível ler a imagem.",
      );
    }
  }

  return (
    <>
      <form
        action={formAction}
        className="space-y-4 rounded-2xl border border-edge-soft vidro-leve p-5"
      >
        {membro && <input type="hidden" name="id" value={membro.id} />}

        {/* Foto */}
        <div className="flex items-center gap-4">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local/Storage
            <img
              src={preview}
              alt="Foto do membro"
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <Avatar nome={membro?.nomeCompleto ?? "?"} fotoUrl={null} tamanho={80} />
          )}
          <div className="flex-1">
            <label htmlFor="foto" className={labelCls}>
              Foto (JPG/PNG — ajustada para 300×300)
            </label>
            <input
              ref={fotoRef}
              id="foto"
              name="foto"
              type="file"
              accept="image/jpeg,image/png"
              onChange={aoEscolherFoto}
              className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-brand-faint file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-text hover:file:bg-brand-soft"
            />
            {erroFoto && <p className="mt-1 text-xs text-danger-text">{erroFoto}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="nomeCompleto" className={labelCls}>
              Nome completo *
            </label>
            <input
              id="nomeCompleto"
              name="nomeCompleto"
              required
              minLength={3}
              maxLength={200}
              defaultValue={membro?.nomeCompleto ?? ""}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="email" className={labelCls}>
              E-mail *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={150}
              defaultValue={membro?.email ?? ""}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="celular" className={labelCls}>
              Celular (WhatsApp)
            </label>
            <input
              id="celular"
              name="celular"
              type="tel"
              maxLength={20}
              defaultValue={membro?.celular ?? ""}
              placeholder="(11) 99999-9999"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="dataNascimento" className={labelCls}>
              Data de nascimento
            </label>
            <input
              id="dataNascimento"
              name="dataNascimento"
              type="date"
              defaultValue={membro?.dataNascimento ?? ""}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="equipeId" className={labelCls}>
              Equipe
            </label>
            <select
              id="equipeId"
              name="equipeId"
              defaultValue={membro?.equipeId ?? ""}
              className={inputCls}
            >
              <option value="">Sem equipe</option>
              {equipes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="observacao" className={labelCls}>
              Observação
            </label>
            <textarea
              id="observacao"
              name="observacao"
              rows={3}
              defaultValue={membro?.observacao ?? ""}
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pendente}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
          >
            {pendente
              ? "Salvando…"
              : membro
                ? "Salvar alterações"
                : "Cadastrar membro"}
          </button>

          {membro?.fotoUrl && (
            <button
              type="submit"
              formAction={acaoRemoverFoto}
              disabled={pendenteFoto}
              className="rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-2 disabled:opacity-60"
            >
              {pendenteFoto ? "Removendo…" : "Remover foto"}
            </button>
          )}
        </div>
      </form>

      {/* Status: ativo / afastado (temporário) / inativo — nunca exclusão. */}
      {membro && (
        <PainelStatus
          membro={membro}
          acaoStatus={acaoStatus}
          pendente={pendenteStatus}
        />
      )}

      <FeedbackModal
        estado={estado}
        onFechar={(e) => {
          // Após criar com sucesso, leva para a lista.
          if (e.ok && !membro) router.push("/membros");
        }}
      />
      <FeedbackModal
        estado={estadoFoto}
        onFechar={(e) => {
          if (e.ok) {
            setPreview(null);
            if (fotoRef.current) fotoRef.current.value = "";
          }
        }}
      />
      <FeedbackModal estado={estadoStatus} />
    </>
  );
}

// Painel de status do membro: afastar (com motivo + retorno previsto),
// inativar (motivo opcional) e reativar. Afastado mantém equipe e login,
// mas sai das listas de presença; inativo sai da equipe e perde o acesso.
function PainelStatus({
  membro,
  acaoStatus,
  pendente,
}: {
  membro: MembroFormDados;
  acaoStatus: (formData: FormData) => void;
  pendente: boolean;
}) {
  const [modo, setModo] = useState<"afastar" | "inativar" | null>(null);

  const retornoBR = membro.retornoPrevisto
    ? membro.retornoPrevisto.split("-").reverse().join("/")
    : "";
  const retornoVencido =
    membro.status === "afastado" &&
    membro.retornoPrevisto !== "" &&
    membro.retornoPrevisto < new Date().toISOString().slice(0, 10);

  const btnLeve =
    "rounded-xl border border-edge px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2 disabled:opacity-60";

  return (
    <div className="mt-4 rounded-2xl border border-edge-soft vidro-leve p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
            Status:
            {membro.status === "ativo" && (
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success-text">
                Ativo
              </span>
            )}
            {membro.status === "afastado" && (
              <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn-text">
                Afastado{retornoBR ? ` até ${retornoBR}` : ""}
              </span>
            )}
            {membro.status === "inativo" && (
              <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger-text">
                Inativo
              </span>
            )}
            {retornoVencido && (
              <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger-text">
                retorno previsto vencido
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-ink-subtle">
            {membro.status === "ativo" &&
              "Afastado (temporário) mantém equipe e acesso, mas sai das listas de presença. Inativo sai da equipe e perde o acesso. Membros nunca são excluídos."}
            {membro.status === "afastado" &&
              `Fora das listas de presença — não gera convocação nem falta.${membro.motivoStatus ? ` Motivo: ${membro.motivoStatus}.` : ""}`}
            {membro.status === "inativo" &&
              `Sem equipe e sem acesso ao sistema; o histórico permanece.${membro.motivoStatus ? ` Motivo: ${membro.motivoStatus}.` : ""}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {membro.status !== "ativo" && (
            <form
              action={acaoStatus}
              onSubmit={(e) => {
                if (!window.confirm(`Reativar ${membro.nomeCompleto}?`))
                  e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={membro.id} />
              <input type="hidden" name="status" value="ativo" />
              <button
                type="submit"
                disabled={pendente}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
              >
                Reativar
              </button>
            </form>
          )}
          {membro.status === "ativo" && (
            <button
              type="button"
              onClick={() => setModo(modo === "afastar" ? null : "afastar")}
              className={btnLeve}
            >
              Afastar…
            </button>
          )}
          {membro.status !== "inativo" && (
            <button
              type="button"
              onClick={() => setModo(modo === "inativar" ? null : "inativar")}
              className={`${btnLeve} hover:border-danger-edge hover:bg-danger-faint hover:text-danger-text`}
            >
              Inativar…
            </button>
          )}
        </div>
      </div>

      {modo === "afastar" && (
        <form
          action={acaoStatus}
          onSubmit={(e) => {
            if (
              !window.confirm(
                `Afastar ${membro.nomeCompleto}? Continua na equipe e com acesso, mas sai das listas de presença até ser reativado(a).`,
              )
            )
              e.preventDefault();
          }}
          className="mt-3 space-y-2 rounded-xl bg-warn-faint p-3"
        >
          <input type="hidden" name="id" value={membro.id} />
          <input type="hidden" name="status" value="afastado" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              name="motivo"
              required
              maxLength={300}
              placeholder="Motivo do afastamento (obrigatório)"
              className={inputCls}
            />
            <label className="flex items-center gap-2 text-xs text-ink-subtle">
              Retorno previsto
              <input name="retornoPrevisto" type="date" className={inputCls} />
            </label>
          </div>
          <button
            type="submit"
            disabled={pendente}
            className="rounded-xl bg-warn px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {pendente ? "Aplicando…" : "Confirmar afastamento"}
          </button>
        </form>
      )}

      {modo === "inativar" && (
        <form
          action={acaoStatus}
          onSubmit={(e) => {
            if (
              !window.confirm(
                `Inativar ${membro.nomeCompleto}? Sai da equipe, perde o acesso ao sistema e deixa de contar nos indicadores daqui em diante. O histórico permanece.`,
              )
            )
              e.preventDefault();
          }}
          className="mt-3 space-y-2 rounded-xl bg-danger-faint p-3"
        >
          <input type="hidden" name="id" value={membro.id} />
          <input type="hidden" name="status" value="inativo" />
          <input
            name="motivo"
            maxLength={300}
            placeholder="Motivo da inativação (opcional)"
            className={inputCls}
          />
          <button
            type="submit"
            disabled={pendente}
            className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white hover:bg-danger-strong disabled:opacity-60"
          >
            {pendente ? "Aplicando…" : "Confirmar inativação"}
          </button>
        </form>
      )}
    </div>
  );
}
