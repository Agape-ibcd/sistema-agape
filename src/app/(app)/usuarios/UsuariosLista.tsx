"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import {
  alterarNivel,
  concederAcesso,
  concederAcessoTodos,
  concederAcessoVarios,
  redefinirSenha,
  revogarAcesso,
  revogarAcessoVarios,
  alterarNivelVarios,
  definirStatusVarios,
  enviarCredenciais,
} from "./actions";
import { definirStatusMembro } from "../membros/actions";
import { FeedbackModal } from "@/components/FeedbackModal";
import { Avatar } from "@/components/Avatar";
import { PessoaHoverCard } from "@/components/PessoaHoverCard";

export type UsuarioLinha = {
  id: string;
  nomeCompleto: string;
  email: string;
  fotoUrl: string | null;
  nivelAcesso: "membro" | "monitor" | "lider" | "admin" | "super_admin";
  temAcesso: boolean;
  status: "ativo" | "afastado" | "inativo";
  motivoStatus: string | null;
  retornoPrevisto: string | null; // "YYYY-MM-DD"
  equipeNome: string | null;
  emailSintetico: boolean;
  temTelegram: boolean;
};

const ROTULOS: Record<UsuarioLinha["nivelAcesso"], string> = {
  membro: "Membro",
  monitor: "Monitor (só leitura)",
  lider: "Líder",
  admin: "Administrador",
  super_admin: "Super Admin",
};

type AcaoMassa =
  | "conceder"
  | "revogar"
  | "afastar"
  | "inativar"
  | "reativar"
  | "nivel";

const ROTULO_MASSA: Record<AcaoMassa, string> = {
  conceder: "Conceder acesso",
  revogar: "Revogar acesso",
  afastar: "Afastar",
  inativar: "Inativar",
  reativar: "Reativar",
  nivel: "Alterar nível",
};

const inputCls =
  "rounded-xl border border-edge px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";
const btnLeve =
  "rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:bg-surface-2 disabled:opacity-50";

function dataBR(iso: string): string {
  return iso.split("-").reverse().join("/");
}

export function UsuariosLista({
  usuarios,
  meuId,
  hojeISO,
}: {
  usuarios: UsuarioLinha[];
  meuId: string;
  hojeISO: string; // "YYYY-MM-DD" (São Paulo) p/ marcar retorno vencido
}) {
  const [estadoNivel, nivelAction, pNivel] = useActionState(alterarNivel, null);
  const [estadoAcesso, acessoAction, pAcesso] = useActionState(concederAcesso, null);
  const [estadoSenha, senhaAction, pSenha] = useActionState(redefinirSenha, null);
  const [estadoTodos, todosAction, pTodos] = useActionState(concederAcessoTodos, null);
  const [estadoRevogar, revogarAction, pRevogar] = useActionState(revogarAcesso, null);
  const [estadoCred, credAction, pCred] = useActionState(enviarCredenciais, null);
  const [estadoStatus, statusAction, pStatus] = useActionState(
    definirStatusMembro,
    null,
  );
  // Ações em massa (uma por tipo, para o resumo aparecer no popup padrão).
  const [estadoMConceder, mConcederAction, pMConceder] = useActionState(
    concederAcessoVarios,
    null,
  );
  const [estadoMRevogar, mRevogarAction, pMRevogar] = useActionState(
    revogarAcessoVarios,
    null,
  );
  const [estadoMStatus, mStatusAction, pMStatus] = useActionState(
    definirStatusVarios,
    null,
  );
  const [estadoMNivel, mNivelAction, pMNivel] = useActionState(
    alterarNivelVarios,
    null,
  );

  const [painelAberto, setPainelAberto] = useState<string | null>(null);
  const [painelCredAberto, setPainelCredAberto] = useState<string | null>(null);
  const [textoShare, setTextoShare] = useState<string | null>(null);
  const [painelTodosAberto, setPainelTodosAberto] = useState(false);
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [acaoMassa, setAcaoMassa] = useState<AcaoMassa | null>(null);
  const [busca, setBusca] = useState("");

  // Busca local (sem ida ao servidor — a lista já está toda na tela), sem
  // diferenciar acentos/maiúsculas.
  const normalizar = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  const buscaNorm = normalizar(busca.trim());
  const visiveis = buscaNorm
    ? usuarios.filter(
        (u) =>
          normalizar(u.nomeCompleto).includes(buscaNorm) ||
          normalizar(u.email).includes(buscaNorm),
      )
    : usuarios;

  const semAcesso = usuarios.filter((u) => !u.temAcesso && u.status !== "inativo");
  const pendenteMassa = pMConceder || pMRevogar || pMStatus || pMNivel;

  function alternarSelecao(id: string) {
    setSelecao((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function limparSelecao() {
    setSelecao(new Set());
    setAcaoMassa(null);
  }

  const idsSelecionados = [...selecao];
  const camposIds = idsSelecionados.map((id) => (
    <input key={id} type="hidden" name="membroIds" value={id} />
  ));

  const confirmarMassa = (msg: string) => (e: React.FormEvent<HTMLFormElement>) => {
    if (!window.confirm(`${msg} (${selecao.size} selecionado(s))`)) e.preventDefault();
  };

  return (
    <>
      {/* Acesso em massa: todos os membros (não inativos) entram no sistema. */}
      <div className="mb-4 rounded-2xl border border-edge-soft vidro-leve p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-ink">
              Acesso para todos os membros
            </p>
            <p className="text-xs text-ink-subtle">
              {semAcesso.length === 0
                ? "Todos os membros ativos já têm acesso de login."
                : `${semAcesso.length} membro(s) ainda sem acesso.`}
            </p>
          </div>
          {semAcesso.length > 0 && (
            <button
              type="button"
              onClick={() => setPainelTodosAberto((v) => !v)}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong"
            >
              Conceder acesso a todos
            </button>
          )}
        </div>
        {painelTodosAberto && semAcesso.length > 0 && (
          <form
            action={todosAction}
            onSubmit={(e) => {
              if (
                !window.confirm(
                  `Criar acesso de login para ${semAcesso.length} membro(s) com a mesma senha inicial? Cada um deve trocar a senha em Meu Perfil.`,
                )
              )
                e.preventDefault();
            }}
            className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-3"
          >
            <input
              type="password"
              name="senha"
              required
              minLength={8}
              placeholder="Senha inicial única (mín. 8)"
              className={`${inputCls} min-w-48 flex-1`}
            />
            <button
              type="submit"
              disabled={pTodos}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
            >
              {pTodos ? "Criando…" : "Criar acessos"}
            </button>
            <p className="w-full text-xs text-ink-subtle">
              Vale também para e-mails sintéticos da migração (o login funciona,
              mas eles não recebem e-mail — atualize o e-mail real quando puder).
            </p>
          </form>
        )}
      </div>

      {/* Barra de ações em massa (aparece com itens selecionados) */}
      {selecao.size > 0 && (
        <div className="sticky top-0 z-10 mb-3 rounded-2xl border border-brand-edge bg-brand-faint p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-brand-text">
              {selecao.size} selecionado(s)
            </span>
            {(Object.keys(ROTULO_MASSA) as AcaoMassa[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAcaoMassa(acaoMassa === a ? null : a)}
                aria-pressed={acaoMassa === a}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                  acaoMassa === a
                    ? "border-brand bg-brand text-white"
                    : "border-edge bg-surface text-ink-soft hover:bg-surface-2"
                }`}
              >
                {ROTULO_MASSA[a]}
              </button>
            ))}
            <button
              type="button"
              onClick={limparSelecao}
              className="ml-auto text-xs font-medium text-ink-subtle underline underline-offset-2"
            >
              Limpar seleção
            </button>
          </div>

          {acaoMassa === "conceder" && (
            <form
              action={mConcederAction}
              onSubmit={confirmarMassa("Conceder acesso com a mesma senha inicial?")}
              className="mt-2 flex flex-wrap items-center gap-2"
            >
              {camposIds}
              <input
                type="password"
                name="senha"
                required
                minLength={8}
                placeholder="Senha inicial única (mín. 8)"
                className={`${inputCls} min-w-48 flex-1`}
              />
              <BotaoMassa pendente={pendenteMassa} rotulo="Conceder" />
            </form>
          )}

          {acaoMassa === "revogar" && (
            <form
              action={mRevogarAction}
              onSubmit={confirmarMassa(
                "Revogar o acesso de login? Cadastros e histórico permanecem.",
              )}
              className="mt-2"
            >
              {camposIds}
              <BotaoMassa pendente={pendenteMassa} rotulo="Revogar acesso" perigo />
            </form>
          )}

          {acaoMassa === "afastar" && (
            <form
              action={mStatusAction}
              onSubmit={confirmarMassa(
                "Afastar? Continuam na equipe e com acesso, mas fora das listas de presença.",
              )}
              className="mt-2 flex flex-wrap items-center gap-2"
            >
              {camposIds}
              <input type="hidden" name="status" value="afastado" />
              <input
                name="motivo"
                required
                maxLength={300}
                placeholder="Motivo do afastamento (obrigatório)"
                className={`${inputCls} min-w-48 flex-1`}
              />
              <label className="flex items-center gap-1.5 text-xs text-ink-subtle">
                Retorno previsto
                <input name="retornoPrevisto" type="date" className={inputCls} />
              </label>
              <BotaoMassa pendente={pendenteMassa} rotulo="Afastar" />
            </form>
          )}

          {acaoMassa === "inativar" && (
            <form
              action={mStatusAction}
              onSubmit={confirmarMassa(
                "Inativar? Saem da equipe e perdem o acesso; o histórico permanece.",
              )}
              className="mt-2 flex flex-wrap items-center gap-2"
            >
              {camposIds}
              <input type="hidden" name="status" value="inativo" />
              <input
                name="motivo"
                maxLength={300}
                placeholder="Motivo (opcional)"
                className={`${inputCls} min-w-48 flex-1`}
              />
              <BotaoMassa pendente={pendenteMassa} rotulo="Inativar" perigo />
            </form>
          )}

          {acaoMassa === "reativar" && (
            <form
              action={mStatusAction}
              onSubmit={confirmarMassa("Reativar os selecionados?")}
              className="mt-2"
            >
              {camposIds}
              <input type="hidden" name="status" value="ativo" />
              <BotaoMassa pendente={pendenteMassa} rotulo="Reativar" />
            </form>
          )}

          {acaoMassa === "nivel" && (
            <form
              action={mNivelAction}
              onSubmit={confirmarMassa("Alterar o nível de acesso?")}
              className="mt-2 flex flex-wrap items-center gap-2"
            >
              {camposIds}
              <select name="nivel" defaultValue="membro" className={inputCls}>
                {Object.entries(ROTULOS).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
              <BotaoMassa pendente={pendenteMassa} rotulo="Aplicar nível" />
            </form>
          )}
        </div>
      )}

      {/* Busca + cabeçalho da lista (selecionar todos os visíveis) */}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar usuário por nome ou e-mail"
          className={`${inputCls} min-w-40 flex-1`}
        />
        <label className="flex items-center gap-2 text-xs font-medium text-ink-subtle">
          <input
            type="checkbox"
            checked={visiveis.length > 0 && visiveis.every((u) => selecao.has(u.id))}
            onChange={(e) =>
              setSelecao(
                e.target.checked ? new Set(visiveis.map((u) => u.id)) : new Set(),
              )
            }
            className="h-4 w-4 accent-brand"
          />
          Selecionar todos ({visiveis.length})
        </label>
      </div>

      <ul className="divide-y divide-edge-soft overflow-hidden rounded-2xl border border-edge-soft vidro-leve">
        {visiveis.length === 0 && (
          <li className="p-6 text-center text-sm text-ink-subtle">
            Ninguém encontrado com essa busca.
          </li>
        )}
        {visiveis.map((u) => {
          const souEu = u.id === meuId;
          const aberto = painelAberto === u.id;
          const inativo = u.status === "inativo";
          const afastado = u.status === "afastado";
          const retornoVencido =
            afastado && u.retornoPrevisto !== null && u.retornoPrevisto < hojeISO;
          return (
            <li key={u.id} className={`px-4 py-3 ${inativo ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="checkbox"
                  aria-label={`Selecionar ${u.nomeCompleto}`}
                  checked={selecao.has(u.id)}
                  onChange={() => alternarSelecao(u.id)}
                  className="h-4 w-4 shrink-0 accent-brand"
                />
                <PessoaHoverCard membroId={u.id} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar nome={u.nomeCompleto} fotoUrl={u.fotoUrl} tamanho={36} />
                  <div className="min-w-0 flex-1">
                    {/* Nome clicável: abre o cadastro completo para edição. */}
                    <Link
                      href={`/membros/${u.id}`}
                      className="block truncate text-sm font-medium text-ink underline-offset-2 hover:text-brand-text hover:underline"
                      title="Editar dados do membro"
                    >
                      {u.nomeCompleto}
                      {souEu && (
                        <span className="ml-1 text-xs text-ink-faint">(você)</span>
                      )}
                    </Link>
                    <p className="truncate text-xs text-ink-subtle">
                      {u.email}
                      {u.equipeNome ? ` · ${u.equipeNome}` : ""}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-1">
                      {inativo && (
                        <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger-text">
                          Inativo
                        </span>
                      )}
                      {afastado && (
                        <span
                          className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn-text"
                          title={u.motivoStatus ?? undefined}
                        >
                          Afastado
                          {u.retornoPrevisto ? ` até ${dataBR(u.retornoPrevisto)}` : ""}
                        </span>
                      )}
                      {retornoVencido && (
                        <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger-text">
                          retorno vencido
                        </span>
                      )}
                      {!u.temAcesso && !inativo && (
                        <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn-text">
                          Sem acesso
                        </span>
                      )}
                      {u.emailSintetico && (
                        <span
                          className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-ink-subtle"
                          title="E-mail gerado na migração — não recebe mensagens"
                        >
                          e-mail sintético
                        </span>
                      )}
                    </p>
                  </div>
                </PessoaHoverCard>

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
                    className={btnLeve}
                  >
                    Aplicar
                  </button>
                </form>

                {/* Ações de acesso e status */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {!inativo && (
                    <button
                      type="button"
                      onClick={() => setPainelAberto(aberto ? null : u.id)}
                      className={
                        u.temAcesso
                          ? btnLeve
                          : "rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-strong"
                      }
                    >
                      {u.temAcesso ? "Redefinir senha" : "Conceder acesso"}
                    </button>
                  )}

                  {!inativo && (
                    <button
                      type="button"
                      onClick={() =>
                        setPainelCredAberto(painelCredAberto === u.id ? null : u.id)
                      }
                      aria-pressed={painelCredAberto === u.id}
                      className={btnLeve}
                    >
                      Enviar credenciais
                    </button>
                  )}

                  {u.temAcesso && !souEu && (
                    <form
                      action={revogarAction}
                      onSubmit={(e) => {
                        if (
                          !window.confirm(
                            `Revogar o acesso de ${u.nomeCompleto}? A conta de login é apagada; o cadastro e o histórico permanecem.`,
                          )
                        )
                          e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="membroId" value={u.id} />
                      <button
                        type="submit"
                        disabled={pRevogar}
                        className={`${btnLeve} hover:border-danger-edge hover:bg-danger-faint hover:text-danger-text`}
                      >
                        Revogar acesso
                      </button>
                    </form>
                  )}

                  {!souEu && u.status !== "ativo" && (
                    <form
                      action={statusAction}
                      onSubmit={(e) => {
                        if (!window.confirm(`Reativar ${u.nomeCompleto}?`))
                          e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="status" value="ativo" />
                      <button type="submit" disabled={pStatus} className={btnLeve}>
                        Reativar
                      </button>
                    </form>
                  )}
                  {!souEu && u.status === "ativo" && (
                    <form
                      action={statusAction}
                      onSubmit={(e) => {
                        if (
                          !window.confirm(
                            `Inativar ${u.nomeCompleto}? Sai da equipe, perde o acesso ao sistema e deixa de contar nos indicadores daqui em diante. O histórico permanece. (Para afastamento temporário, use "Afastar" na seleção em massa ou no cadastro do membro.)`,
                          )
                        )
                          e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="status" value="inativo" />
                      <button
                        type="submit"
                        disabled={pStatus}
                        className={`${btnLeve} hover:border-danger-edge hover:bg-danger-faint hover:text-danger-text`}
                      >
                        Inativar
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {aberto && !inativo && (
                <form
                  action={u.temAcesso ? senhaAction : acessoAction}
                  className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-3"
                >
                  <input type="hidden" name="membroId" value={u.id} />
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
                    className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
                  >
                    {u.temAcesso ? "Redefinir" : "Criar acesso"}
                  </button>
                  <p className="w-full text-xs text-ink-subtle">
                    A senha definida aqui é provisória — o membro terá de criar
                    uma nova no primeiro acesso.
                    {u.emailSintetico &&
                      " E-mail sintético: o login funciona, mas não recebe e-mails."}
                  </p>
                </form>
              )}

              {/* Enviar credenciais: gera senha provisória e entrega por canal. */}
              {painelCredAberto === u.id && !inativo && (
                <form
                  action={credAction}
                  className="mt-3 rounded-xl bg-surface-2 p-3"
                  onSubmit={(e) => {
                    if (
                      !window.confirm(
                        `Gerar uma nova senha provisória para ${u.nomeCompleto} e enviar? A senha atual dele (se houver) deixará de funcionar, e ele terá de definir uma nova no primeiro acesso.`,
                      )
                    )
                      e.preventDefault();
                  }}
                >
                  <input type="hidden" name="membroId" value={u.id} />
                  <p className="mb-2 text-xs text-ink-soft">
                    Gera uma senha provisória e envia login + senha. O membro é
                    obrigado a trocar a senha no primeiro acesso.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      name="canal"
                      value="email"
                      disabled={pCred || u.emailSintetico}
                      title={
                        u.emailSintetico
                          ? "E-mail sintético não recebe mensagens"
                          : undefined
                      }
                      className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
                    >
                      Por e-mail
                    </button>
                    <button
                      type="submit"
                      name="canal"
                      value="telegram"
                      disabled={pCred || !u.temTelegram}
                      title={
                        u.temTelegram ? undefined : "Membro sem Telegram vinculado"
                      }
                      className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
                    >
                      Por Telegram
                    </button>
                    <button
                      type="submit"
                      name="canal"
                      value="compartilhar"
                      disabled={pCred}
                      className="rounded-lg border border-edge px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-surface-3 disabled:opacity-50"
                    >
                      Compartilhar…
                    </button>
                  </div>
                  {(u.emailSintetico || !u.temTelegram) && (
                    <p className="mt-2 text-xs text-ink-subtle">
                      {u.emailSintetico && "E-mail sintético (não recebe). "}
                      {!u.temTelegram && "Telegram não vinculado. "}
                      Use “Compartilhar” para copiar/enviar a mensagem manualmente.
                    </p>
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
      <FeedbackModal
        estado={estadoTodos}
        onFechar={() => setPainelTodosAberto(false)}
      />
      <FeedbackModal estado={estadoRevogar} />
      <FeedbackModal estado={estadoStatus} />
      <FeedbackModal
        estado={estadoCred}
        onFechar={() => {
          setPainelCredAberto(null);
          // "Compartilhar" devolve o texto pronto — abre o modal de partilha.
          if (estadoCred?.textoCompartilhar) setTextoShare(estadoCred.textoCompartilhar);
        }}
      />
      {textoShare && (
        <ModalCompartilhar texto={textoShare} onFechar={() => setTextoShare(null)} />
      )}
      <FeedbackModal
        estado={estadoMConceder}
        onFechar={(e) => e.ok && limparSelecao()}
      />
      <FeedbackModal
        estado={estadoMRevogar}
        onFechar={(e) => e.ok && limparSelecao()}
      />
      <FeedbackModal
        estado={estadoMStatus}
        onFechar={(e) => e.ok && limparSelecao()}
      />
      <FeedbackModal
        estado={estadoMNivel}
        onFechar={(e) => e.ok && limparSelecao()}
      />
    </>
  );
}

// Modal de compartilhamento: mostra a mensagem com login + senha provisória e
// oferece "Compartilhar" (Web Share API, dentro do gesto do clique) e "Copiar".
function ModalCompartilhar({
  texto,
  onFechar,
}: {
  texto: string;
  onFechar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const podeCompartilhar =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function compartilhar() {
    try {
      await navigator.share({ title: "Acesso ao Sistema Ágape", text: texto });
    } catch {
      // Cancelado pelo usuário ou indisponível — silencioso (há o botão Copiar).
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl vidro-forte p-5 shadow-xl">
        <h3 className="text-base font-semibold text-ink">Compartilhar credenciais</h3>
        <p className="mt-1 text-xs text-ink-subtle">
          A senha provisória já foi definida. Envie esta mensagem ao membro — ele
          terá de trocar a senha no primeiro acesso.
        </p>
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-edge-soft bg-surface-2 p-3 text-xs text-ink">
          {texto}
        </pre>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={copiar}
            className="rounded-xl border border-edge px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2"
          >
            {copiado ? "Copiado ✓" : "Copiar"}
          </button>
          {podeCompartilhar && (
            <button
              type="button"
              onClick={compartilhar}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong"
            >
              Compartilhar…
            </button>
          )}
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl bg-surface-3 px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function BotaoMassa({
  pendente,
  rotulo,
  perigo = false,
}: {
  pendente: boolean;
  rotulo: string;
  perigo?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pendente}
      className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
        perigo ? "bg-danger hover:bg-danger-strong" : "bg-brand hover:bg-brand-strong"
      }`}
    >
      {pendente ? "Aplicando…" : rotulo}
    </button>
  );
}
