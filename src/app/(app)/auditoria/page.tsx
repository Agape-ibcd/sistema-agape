import Link from "next/link";
import { requirePermissao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  listarAuditoria,
  opcoesFiltroAuditoria,
  inicioDoDiaSP,
  fimDoDiaSP,
} from "@/lib/auditoria";
import { rotuloAcao, rotuloTabela } from "@/lib/auditoriaRotulos";
import { FiltrosAuditoria } from "./FiltrosAuditoria";
import { DetalheAuditoria } from "./DetalheAuditoria";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{
    acao?: string;
    tabela?: string;
    usuario?: string;
    de?: string;
    ate?: string;
    pagina?: string;
  }>;
}) {
  await requirePermissao("configuracoes_sistema");

  const params = await searchParams;
  const acao = params.acao ?? "";
  const tabela = params.tabela ?? "";
  const usuarioId = params.usuario ?? "";
  const de = params.de ?? "";
  const ate = params.ate ?? "";
  const pagina = Math.max(1, Number(params.pagina) || 1);

  const [{ registros, total, totalPaginas }, { acoes, tabelas }, usuarios] = await Promise.all([
    listarAuditoria({
      acao: acao || undefined,
      tabela: tabela || undefined,
      usuarioId: usuarioId || undefined,
      de: de ? (inicioDoDiaSP(de) ?? undefined) : undefined,
      ate: ate ? (fimDoDiaSP(ate) ?? undefined) : undefined,
      pagina,
    }),
    opcoesFiltroAuditoria(),
    prisma.membro.findMany({
      select: { id: true, nomeCompleto: true },
      orderBy: { nomeCompleto: "asc" },
    }),
  ]);

  function linkPagina(p: number) {
    const q = new URLSearchParams();
    if (acao) q.set("acao", acao);
    if (tabela) q.set("tabela", tabela);
    if (usuarioId) q.set("usuario", usuarioId);
    if (de) q.set("de", de);
    if (ate) q.set("ate", ate);
    if (p > 1) q.set("pagina", String(p));
    const qs = q.toString();
    return qs ? `/auditoria?${qs}` : "/auditoria";
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-semibold uppercase tracking-wide text-ink">
          Auditoria
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Trilha completa de ações realizadas no sistema — {total} registro
          {total === 1 ? "" : "s"} no filtro atual.
        </p>
      </header>

      <FiltrosAuditoria
        acao={acao}
        tabela={tabela}
        usuarioId={usuarioId}
        de={de}
        ate={ate}
        acoes={acoes}
        tabelas={tabelas}
        usuarios={usuarios}
      />

      {registros.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-edge p-8 text-center text-sm text-ink-subtle">
          Nenhum registro encontrado para os filtros selecionados.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-edge-soft vidro-leve">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-ink-subtle">
              <tr>
                <th className="px-4 py-2.5">Quando</th>
                <th className="px-4 py-2.5">Usuário</th>
                <th className="px-4 py-2.5">Ação</th>
                <th className="px-4 py-2.5">Tabela</th>
                <th className="px-4 py-2.5">Registro</th>
                <th className="px-4 py-2.5">IP</th>
                <th className="px-4 py-2.5">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge-soft">
              {registros.map((r) => (
                <tr key={r.id} className="align-top hover:bg-surface-2">
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">
                    {r.timestamp.toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-ink">
                    {r.usuarioNome ?? <span className="text-ink-subtle">Sistema</span>}
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">{rotuloAcao(r.acao)}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{rotuloTabela(r.tabelaAfetada)}</td>
                  <td className="max-w-[10rem] truncate px-4 py-2.5 text-ink-subtle" title={r.registroId ?? ""}>
                    {r.registroId ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-ink-subtle">{r.ip ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <DetalheAuditoria dadosAnteriores={r.dadosAnteriores} dadosNovos={r.dadosNovos} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
          <span>
            Página {pagina} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <PaginaLink href={linkPagina(pagina - 1)} desabilitado={pagina <= 1}>
              ← Anterior
            </PaginaLink>
            <PaginaLink href={linkPagina(pagina + 1)} desabilitado={pagina >= totalPaginas}>
              Próxima →
            </PaginaLink>
          </div>
        </div>
      )}
    </div>
  );
}

function PaginaLink({
  href,
  desabilitado,
  children,
}: {
  href: string;
  desabilitado: boolean;
  children: React.ReactNode;
}) {
  if (desabilitado) {
    return (
      <span className="cursor-not-allowed rounded-xl border border-edge px-3 py-1.5 text-ink-subtle opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className="rounded-xl border border-edge px-3 py-1.5 hover:bg-surface-2">
      {children}
    </Link>
  );
}
