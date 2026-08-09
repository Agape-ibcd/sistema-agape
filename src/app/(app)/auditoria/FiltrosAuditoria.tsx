"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Popover } from "@/components/Popover";
import { rotuloAcao, rotuloTabela } from "@/lib/auditoriaRotulos";

export function FiltrosAuditoria({
  acao,
  tabela,
  usuarioId,
  de,
  ate,
  acoes,
  tabelas,
  usuarios,
}: {
  acao: string;
  tabela: string;
  usuarioId: string;
  de: string;
  ate: string;
  acoes: string[];
  tabelas: string[];
  usuarios: { id: string; nomeCompleto: string }[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function navegar(proximo: Partial<{ acao: string; tabela: string; usuarioId: string; de: string; ate: string }>) {
    const atual = { acao, tabela, usuarioId, de, ate, ...proximo };
    const p = new URLSearchParams();
    if (atual.acao) p.set("acao", atual.acao);
    if (atual.tabela) p.set("tabela", atual.tabela);
    if (atual.usuarioId) p.set("usuario", atual.usuarioId);
    if (atual.de) p.set("de", atual.de);
    if (atual.ate) p.set("ate", atual.ate);
    // qualquer mudança de filtro volta pra 1ª página
    const qs = p.toString();
    iniciar(() => router.push(qs ? `/auditoria?${qs}` : "/auditoria"));
  }

  const qtdFiltros = [acao, tabela, usuarioId, de, ate].filter(Boolean).length;

  const inputCls =
    "w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";

  return (
    <div className={`mb-4 flex flex-wrap items-center gap-2 transition-opacity ${pendente ? "opacity-70" : ""}`}>
      <Popover rotulo="Filtros" badge={qtdFiltros} align="left" panelClassName="w-[min(24rem,calc(100vw-2rem))]">
        {(fechar) => (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
              Ação
              <select
                value={acao}
                onChange={(e) => navegar({ acao: e.target.value })}
                className={inputCls}
              >
                <option value="">Todas as ações</option>
                {acoes.map((a) => (
                  <option key={a} value={a}>
                    {rotuloAcao(a)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
              Tabela
              <select
                value={tabela}
                onChange={(e) => navegar({ tabela: e.target.value })}
                className={inputCls}
              >
                <option value="">Todas as tabelas</option>
                {tabelas.map((t) => (
                  <option key={t} value={t}>
                    {rotuloTabela(t)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
              Usuário
              <select
                value={usuarioId}
                onChange={(e) => navegar({ usuarioId: e.target.value })}
                className={inputCls}
              >
                <option value="">Todos os usuários</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nomeCompleto}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-ink-soft">
                De
                <input
                  type="date"
                  value={de}
                  onChange={(e) => navegar({ de: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-ink-soft">
                Até
                <input
                  type="date"
                  value={ate}
                  onChange={(e) => navegar({ ate: e.target.value })}
                  className={inputCls}
                />
              </label>
            </div>

            {qtdFiltros > 0 && (
              <button
                type="button"
                onClick={() => {
                  navegar({ acao: "", tabela: "", usuarioId: "", de: "", ate: "" });
                  fechar();
                }}
                className="self-end rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-soft underline-offset-2 hover:text-danger-text hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </Popover>
    </div>
  );
}
