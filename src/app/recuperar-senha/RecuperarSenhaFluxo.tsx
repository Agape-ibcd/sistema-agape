"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { pedirCodigo, verificarCodigo, redefinirSenha } from "./actions";

const inputCls =
  "w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";
const labelCls = "mb-1 block text-sm font-medium text-ink-soft";
const botaoCls =
  "w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60";

type Etapa = "email" | "codigo" | "senha" | "pronto";

// Fluxo de recuperação em 3 passos numa tela só. Chama as server actions
// diretamente via useTransition e atualiza o estado nos handlers (nunca em
// useEffect — o lint deste repo proíbe setState em effect). O e-mail nunca
// vai para a URL; fica só no estado local.
export function RecuperarSenhaFluxo() {
  const [etapa, setEtapa] = useState<Etapa>("email");
  const [email, setEmail] = useState("");
  const [tokenReset, setTokenReset] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function enviarEmail(formData: FormData) {
    const valor = String(formData.get("email") ?? "");
    setErro(null);
    startTransition(async () => {
      const r = await pedirCodigo(valor);
      if (r.ok) {
        setEmail(valor.trim().toLowerCase());
        setAviso(r.message);
        setEtapa("codigo");
      } else {
        setErro(r.message);
      }
    });
  }

  function enviarCodigo(formData: FormData) {
    const codigo = String(formData.get("codigo") ?? "");
    setErro(null);
    startTransition(async () => {
      const r = await verificarCodigo(email, codigo);
      if (r.ok) {
        setTokenReset(r.tokenReset);
        setEtapa("senha");
      } else {
        setErro(r.message);
      }
    });
  }

  function enviarSenha(formData: FormData) {
    const senha = String(formData.get("senha") ?? "");
    const confirma = String(formData.get("confirma") ?? "");
    setErro(null);
    startTransition(async () => {
      const r = await redefinirSenha(tokenReset, senha, confirma);
      if (r.ok) {
        setEtapa("pronto");
      } else {
        setErro(r.message);
      }
    });
  }

  const passos = ["email", "codigo", "senha"] as const;
  const indiceAtual = passos.indexOf(etapa as (typeof passos)[number]);

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-sm">
      {/* Indicador de passos */}
      {etapa !== "pronto" && (
        <ol className="mb-5 flex items-center justify-center gap-2 text-xs font-medium">
          {passos.map((p, i) => {
            const ativo = etapa === p;
            const concluido = indiceAtual > i;
            return (
              <li key={p} className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    ativo
                      ? "bg-brand text-white"
                      : concluido
                        ? "bg-success text-white"
                        : "bg-surface-2 text-ink-subtle"
                  }`}
                >
                  {concluido ? "✓" : i + 1}
                </span>
                {i < 2 && <span className="h-px w-5 bg-edge" />}
              </li>
            );
          })}
        </ol>
      )}

      {/* Passo 1 — e-mail */}
      {etapa === "email" && (
        <form action={enviarEmail} className="space-y-4">
          <div>
            <h1 className="text-lg font-semibold text-ink">Recuperar senha</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Informe o e-mail do seu cadastro. Enviaremos um código de 6
              dígitos por e-mail e/ou Telegram.
            </p>
          </div>
          <div>
            <label htmlFor="email" className={labelCls}>
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={email}
              className={inputCls}
              placeholder="voce@exemplo.com"
            />
          </div>
          {erro && (
            <p className="rounded-lg bg-danger-faint px-3 py-2 text-sm text-danger-text">
              {erro}
            </p>
          )}
          <button type="submit" disabled={pendente} className={botaoCls}>
            {pendente ? "Enviando…" : "Enviar código"}
          </button>
        </form>
      )}

      {/* Passo 2 — código */}
      {etapa === "codigo" && (
        <form action={enviarCodigo} className="space-y-4">
          <div>
            <h1 className="text-lg font-semibold text-ink">Digite o código</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {aviso ?? "Digite o código de 6 dígitos que você recebeu."}
            </p>
          </div>
          <div>
            <label htmlFor="codigo" className={labelCls}>
              Código de 6 dígitos
            </label>
            <input
              id="codigo"
              name="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              className={`${inputCls} text-center text-lg tracking-[0.5em]`}
              placeholder="000000"
            />
          </div>
          {erro && (
            <p className="rounded-lg bg-danger-faint px-3 py-2 text-sm text-danger-text">
              {erro}
            </p>
          )}
          <button type="submit" disabled={pendente} className={botaoCls}>
            {pendente ? "Verificando…" : "Verificar código"}
          </button>
          <button
            type="button"
            onClick={() => {
              setErro(null);
              setEtapa("email");
            }}
            className="w-full text-center text-xs text-ink-subtle hover:text-ink-soft"
          >
            Não recebeu? Voltar e enviar de novo
          </button>
        </form>
      )}

      {/* Passo 3 — nova senha */}
      {etapa === "senha" && (
        <form action={enviarSenha} className="space-y-4">
          <div>
            <h1 className="text-lg font-semibold text-ink">Nova senha</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Defina a sua nova senha (mínimo 8 caracteres).
            </p>
          </div>
          <div>
            <label htmlFor="senha" className={labelCls}>
              Nova senha
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="confirma" className={labelCls}>
              Confirmar nova senha
            </label>
            <input
              id="confirma"
              name="confirma"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={inputCls}
            />
          </div>
          {erro && (
            <p className="rounded-lg bg-danger-faint px-3 py-2 text-sm text-danger-text">
              {erro}
            </p>
          )}
          <button type="submit" disabled={pendente} className={botaoCls}>
            {pendente ? "Salvando…" : "Redefinir senha"}
          </button>
        </form>
      )}

      {/* Passo final — pronto */}
      {etapa === "pronto" && (
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-2xl text-success-text">
            ✓
          </span>
          <h1 className="text-lg font-semibold text-ink">Senha redefinida!</h1>
          <p className="text-sm text-ink-soft">
            Sua senha foi alterada com sucesso. Agora entre com a nova senha.
          </p>
          <Link href="/login" className={`${botaoCls} inline-block`}>
            Ir para o login
          </Link>
        </div>
      )}

      {etapa !== "pronto" && (
        <p className="mt-5 text-center text-sm">
          <Link href="/login" className="text-brand-text hover:underline">
            Voltar ao login
          </Link>
        </p>
      )}
    </div>
  );
}
