"use client";

import { useRef, useState, useActionState } from "react";
import {
  atualizarPerfil,
  solicitarAlteracaoDados,
  atualizarFotoPerfil,
  removerFotoPerfil,
} from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";
import { Avatar } from "@/components/Avatar";
import { prepararFotoInput } from "@/lib/fotoCliente";

type PendenteInfo = {
  nomeCompleto: string;
  email: string;
  criadoEm: string;
  expiraEm: string;
};

type Props = {
  nome: string;
  email: string;
  fotoUrl: string | null;
  celular: string;
  observacao: string;
  dataNascimento: string; // "YYYY-MM-DD" ou ""
  pendente: PendenteInfo | null;
};

export function PerfilForm({
  nome,
  email,
  fotoUrl,
  celular,
  observacao,
  dataNascimento,
  pendente,
}: Props) {
  const [estado, formAction, pendenteObs] = useActionState(atualizarPerfil, null);
  const [estadoDados, dadosAction, pendenteDados] = useActionState(
    solicitarAlteracaoDados,
    null,
  );
  const [estadoFoto, fotoAction, pendenteFoto] = useActionState(
    atualizarFotoPerfil,
    null,
  );
  const [estadoRemover, removerAction, pendenteRemover] = useActionState(
    removerFotoPerfil,
    null,
  );

  const [preview, setPreview] = useState<string | null>(fotoUrl);
  const [fotoEscolhida, setFotoEscolhida] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    setErroFoto(null);
    try {
      const url = await prepararFotoInput(e);
      if (url) {
        setPreview(url);
        setFotoEscolhida(true);
      }
    } catch (erro) {
      e.target.value = "";
      setFotoEscolhida(false);
      setErroFoto(
        erro instanceof Error ? erro.message : "Não foi possível ler a imagem.",
      );
    }
  }

  function limparEscolha() {
    setFotoEscolhida(false);
    if (fotoRef.current) fotoRef.current.value = "";
  }

  return (
    <>
      {/* Foto do perfil — mesmo fluxo do cadastro de membros (300×300 → Storage) */}
      <form
        action={fotoAction}
        className="mb-6 rounded-2xl border border-edge-soft vidro-leve p-5"
      >
        <div className="flex items-center gap-4">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local/Storage
            <img
              src={preview}
              alt="Sua foto"
              className="h-20 w-20 shrink-0 rounded-full object-cover"
            />
          ) : (
            <Avatar nome={nome} fotoUrl={null} tamanho={80} />
          )}
          <div className="min-w-0 flex-1">
            <label
              htmlFor="foto"
              className="mb-1 block text-sm font-medium text-ink-soft"
            >
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
            {erroFoto && (
              <p className="mt-1 text-xs text-danger-text">{erroFoto}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!fotoEscolhida || pendenteFoto}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
              >
                {pendenteFoto ? "Enviando…" : "Salvar foto"}
              </button>
              {fotoUrl && !fotoEscolhida && (
                <button
                  type="submit"
                  formAction={removerAction}
                  disabled={pendenteRemover}
                  className="rounded-xl border border-edge px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2 disabled:opacity-60"
                >
                  {pendenteRemover ? "Removendo…" : "Remover foto"}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Nome/e-mail/celular/nascimento — não aplica na hora: pede confirmação
          por e-mail/Telegram (link válido por 24h) antes de gravar. */}
      <form
        action={dadosAction}
        className="mb-6 space-y-4 rounded-2xl border border-edge-soft vidro-leve p-5"
      >
        <div>
          <h3 className="text-sm font-semibold text-ink">Dados cadastrais</h3>
          <p className="mt-0.5 text-xs text-ink-subtle">
            Alterar qualquer um destes campos gera um link de confirmação
            (válido por 24h) enviado ao seu e-mail/Telegram atuais — a
            mudança só entra em vigor depois de confirmada.
          </p>
        </div>

        {pendente && (
          <div className="rounded-xl border border-info-edge bg-info-faint p-3 text-xs text-info-text">
            Você tem uma alteração pendente de confirmação (nome &quot;
            {pendente.nomeCompleto}&quot;, e-mail {pendente.email}), enviada
            em{" "}
            {new Date(pendente.criadoEm).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
            . Vale até{" "}
            {new Date(pendente.expiraEm).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
            . Confira sua caixa de entrada/Telegram — enviar de novo abaixo
            gera um novo link e cancela este.
          </div>
        )}

        <div>
          <label
            htmlFor="nomeCompleto"
            className="mb-1 block text-sm font-medium text-ink-soft"
          >
            Nome completo
          </label>
          <input
            id="nomeCompleto"
            name="nomeCompleto"
            type="text"
            defaultValue={nome}
            maxLength={200}
            className="w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-ink-soft"
          >
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={email}
            maxLength={150}
            className="w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
          />
        </div>

        <div>
          <label
            htmlFor="celular"
            className="mb-1 block text-sm font-medium text-ink-soft"
          >
            Celular (WhatsApp)
          </label>
          <input
            id="celular"
            name="celular"
            type="tel"
            defaultValue={celular}
            maxLength={20}
            className="w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
            placeholder="(11) 99999-9999"
          />
        </div>

        <div>
          <label
            htmlFor="dataNascimento"
            className="mb-1 block text-sm font-medium text-ink-soft"
          >
            Data de nascimento
          </label>
          <input
            id="dataNascimento"
            name="dataNascimento"
            type="date"
            defaultValue={dataNascimento}
            className="w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
          />
        </div>

        <button
          type="submit"
          disabled={pendenteDados}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pendenteDados ? "Enviando…" : "Enviar link de confirmação"}
        </button>
      </form>

      <form
        action={formAction}
        className="space-y-4 rounded-2xl border border-edge-soft vidro-leve p-5"
      >
        <div>
          <label
            htmlFor="observacao"
            className="mb-1 block text-sm font-medium text-ink-soft"
          >
            Observação
          </label>
          <textarea
            id="observacao"
            name="observacao"
            defaultValue={observacao}
            rows={3}
            className="w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
            placeholder="Alguma observação sobre você"
          />
        </div>

        <button
          type="submit"
          disabled={pendenteObs}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pendenteObs ? "Salvando…" : "Salvar observação"}
        </button>
      </form>

      <FeedbackModal estado={estado} />
      <FeedbackModal estado={estadoDados} />
      <FeedbackModal
        estado={estadoFoto}
        onFechar={(e) => {
          if (e.ok) limparEscolha();
        }}
      />
      <FeedbackModal
        estado={estadoRemover}
        onFechar={(e) => {
          if (e.ok) {
            setPreview(null);
            limparEscolha();
          }
        }}
      />
    </>
  );
}
