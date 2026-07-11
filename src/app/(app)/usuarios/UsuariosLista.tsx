"use client";

import { useState, useActionState } from "react";
import { alterarNivel, concederAcesso, redefinirSenha } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";
import { Avatar } from "@/components/Avatar";

export type UsuarioLinha = {
  id: string;
  nomeCompleto: string;
  email: string;
  fotoUrl: string | null;
  nivelAcesso: "membro" | "lider" | "admin" | "super_admin";
  temAcesso: boolean;
  status: "ativo" | "inativo";
  equipeNome: string | null;
  emailSintetico: boolean;
};

const ROTULOS: Record<UsuarioLinha["nivelAcesso"], string> = {
  membro: "Membro",
  lider: "Líder",
  admin: "Administrador",
  super_admin: "Super Admin",
};

export function UsuariosLista({
  usuarios,
  meuId,
}: {
  usuarios: UsuarioLinha[];
  meuId: string;
}) {
  const [estadoNivel, nivelAction, pNivel] = useActionState(alterarNivel, null);
  const [estadoAcesso, acessoAction, pAcesso] = useActionState(concederAcesso, null);
  const [estadoSenha, senhaAction, pSenha] = useActionState(redefinirSenha, null);
  // Linha com o painel de senha aberto (conceder acesso ou redefinir).
  const [painelAberto, setPainelAberto] = useState<string | null>(null);

  const inputCls =
    "rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

  return (
    <>
      <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {usuarios.map((u) => {
          const souEu = u.id === meuId;
          const aberto = painelAberto === u.id;
          return (
            <li key={u.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar nome={u.nomeCompleto} fotoUrl={u.fotoUrl} tamanho={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {u.nomeCompleto}
                    {souEu && <span className="ml-1 text-xs text-zinc-400">(você)</span>}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {u.email}
                    {u.equipeNome ? ` · ${u.equipeNome}` : ""}
                    {u.status === "inativo" ? " · INATIVO" : ""}
                  </p>
                </div>

                {/* Nível de acesso */}
                <form
                  action={nivelAction}
                  onSubmit={(e) => {
                    const sel = e.currentTarget.elements.namedItem(
                      "nivel",
                    ) as HTMLSelectElement;
                    if (
                      !window.confirm(
                        `Alterar o nível de ${u.nomeCompleto} para ${
                          ROTULOS[sel.value as UsuarioLinha["nivelAcesso"]]
                        }?`,
                      )
                    )
                      e.preventDefault();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input type="hidden" name="membroId" value={u.id} />
                  <select
                    name="nivel"
                    defaultValue={u.nivelAcesso}
                    disabled={souEu}
                    className={`${inputCls} py-1.5`}
                  >
                    {Object.entries(ROTULOS).map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={souEu || pNivel}
                    className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Aplicar
                  </button>
                </form>

                {/* Acesso de login */}
                <button
                  type="button"
                  onClick={() => setPainelAberto(aberto ? null : u.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    u.temAcesso
                      ? "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                >
                  {u.temAcesso ? "Redefinir senha" : "Conceder acesso"}
                </button>
              </div>

              {aberto && (
                <form
                  action={u.temAcesso ? senhaAction : acessoAction}
                  className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-zinc-50 p-3"
                >
                  <input type="hidden" name="membroId" value={u.id} />
                  {u.emailSintetico && !u.temAcesso ? (
                    <p className="text-xs text-amber-700">
                      E-mail sintético da migração — cadastre o e-mail real em
                      Membros antes de conceder acesso.
                    </p>
                  ) : (
                    <>
                      <input
                        type="password"
                        name="senha"
                        required
                        minLength={8}
                        placeholder={
                          u.temAcesso ? "Nova senha (mín. 8)" : "Senha inicial (mín. 8)"
                        }
                        className={`${inputCls} min-w-48 flex-1`}
                      />
                      <button
                        type="submit"
                        disabled={pAcesso || pSenha}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {u.temAcesso ? "Redefinir" : "Criar acesso"}
                      </button>
                      <p className="w-full text-xs text-zinc-500">
                        Oriente o membro a trocar a senha no primeiro login (Meu Perfil).
                      </p>
                    </>
                  )}
                </form>
              )}
            </li>
          );
        })}
      </ul>

      <FeedbackModal estado={estadoNivel} />
      <FeedbackModal estado={estadoAcesso} onFechar={() => setPainelAberto(null)} />
      <FeedbackModal estado={estadoSenha} onFechar={() => setPainelAberto(null)} />
    </>
  );
}
