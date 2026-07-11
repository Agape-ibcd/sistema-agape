"use client";

import { useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { salvarMembro, removerFoto, alternarStatusMembro } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";
import { Avatar } from "@/components/Avatar";

export type MembroFormDados = {
  id: string;
  nomeCompleto: string;
  email: string;
  celular: string;
  dataNascimento: string; // "YYYY-MM-DD" ou ""
  equipeId: string;
  observacao: string;
  fotoUrl: string | null;
  status: "ativo" | "inativo";
};

type Props = {
  membro: MembroFormDados | null; // null = cadastro novo
  equipes: { id: string; nome: string }[];
};

// Redimensiona a imagem escolhida para 300×300 (corte central "cover") ainda
// no navegador — regra do PDF — e devolve um JPEG leve para o upload.
async function redimensionar300(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const lado = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - lado) / 2;
  const sy = (bitmap.height - lado) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 300;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  ctx.drawImage(bitmap, sx, sy, lado, lado, 0, 0, 300, 300);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao processar a imagem."))),
      "image/jpeg",
      0.85,
    );
  });
}

const inputCls =
  "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";
const labelCls = "mb-1 block text-sm font-medium text-zinc-700";

export function MembroForm({ membro, equipes }: Props) {
  const router = useRouter();
  const [estado, formAction, pendente] = useActionState(salvarMembro, null);
  const [estadoFoto, acaoRemoverFoto, pendenteFoto] = useActionState(removerFoto, null);
  const [estadoStatus, acaoStatus, pendenteStatus] = useActionState(
    alternarStatusMembro,
    null,
  );

  const [preview, setPreview] = useState<string | null>(membro?.fotoUrl ?? null);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErroFoto(null);
    try {
      const blob = await redimensionar300(arquivo);
      const jpeg = new File([blob], "foto.jpg", { type: "image/jpeg" });
      const dt = new DataTransfer();
      dt.items.add(jpeg);
      e.target.files = dt.files; // o form envia a versão 300×300, não a original
      setPreview(URL.createObjectURL(blob));
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
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5"
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
              className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
            />
            {erroFoto && <p className="mt-1 text-xs text-red-600">{erroFoto}</p>}
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
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
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
              className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              {pendenteFoto ? "Removendo…" : "Remover foto"}
            </button>
          )}
        </div>
      </form>

      {/* Inativação/reativação — nunca exclusão (regra do PDF). */}
      {membro && (
        <form
          action={acaoStatus}
          onSubmit={(e) => {
            const msg =
              membro.status === "ativo"
                ? `Inativar ${membro.nomeCompleto}? O histórico de presenças é preservado e o membro deixa de aparecer nas listas de registro.`
                : `Reativar ${membro.nomeCompleto}?`;
            if (!window.confirm(msg)) e.preventDefault();
          }}
          className="mt-4 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5"
        >
          <input type="hidden" name="id" value={membro.id} />
          <div>
            <p className="text-sm font-medium text-zinc-900">
              {membro.status === "ativo" ? "Inativar membro" : "Membro inativo"}
            </p>
            <p className="text-xs text-zinc-500">
              Membros nunca são excluídos — apenas inativados, preservando o histórico.
            </p>
          </div>
          <button
            type="submit"
            disabled={pendenteStatus}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${
              membro.status === "ativo"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {pendenteStatus
              ? "Aplicando…"
              : membro.status === "ativo"
                ? "Inativar"
                : "Reativar"}
          </button>
        </form>
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
