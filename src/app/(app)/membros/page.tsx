import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/lib/auth";
import { acessoMembros } from "@/lib/acessoMembros";
import { Avatar } from "@/components/Avatar";
import { PessoaHoverCard } from "@/components/PessoaHoverCard";
import { FiltrosMembros } from "./FiltrosMembros";

// Lista de membros com busca por nome/e-mail e filtros por equipe e status.
// Admin/super veem todos; o líder vê SÓ a própria equipe (escopo travado no
// servidor, sem botão de novo cadastro nem filtro de equipe).
export default async function MembrosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; equipe?: string; status?: string }>;
}) {
  const usuario = await requireUsuario();
  const acesso = acessoMembros(usuario);
  if (acesso === "nenhum") redirect("/nao-autorizado");
  const escopoEquipe = acesso === "equipe";

  const { busca = "", equipe = "", status = "ativo" } = await searchParams;

  const where: Prisma.MembroWhereInput = {};
  if (busca) {
    where.OR = [
      { nomeCompleto: { contains: busca, mode: "insensitive" } },
      { email: { contains: busca, mode: "insensitive" } },
    ];
  }
  // Líder: sempre a própria equipe (ignora o que veio na URL). Sem equipe
  // vinculada, não vê ninguém — situação anômala, mas resolvida com segurança.
  if (escopoEquipe) {
    where.equipeId = usuario.equipeId ?? "__sem_equipe__";
  } else if (equipe) {
    where.equipeId = equipe;
  }
  if (status === "ativo" || status === "afastado" || status === "inativo") {
    where.status = status;
  }

  const [membros, equipes] = await Promise.all([
    prisma.membro.findMany({
      where,
      orderBy: { nomeCompleto: "asc" },
      include: { equipe: { select: { nome: true, corHex: true } } },
    }),
    escopoEquipe
      ? Promise.resolve([] as { id: string; nome: string }[])
      : prisma.equipe.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold uppercase tracking-wide text-ink">
            {escopoEquipe ? "Membros da equipe" : "Membros"}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {escopoEquipe && usuario.equipeNome ? `${usuario.equipeNome} · ` : ""}
            {membros.length} membro(s) na seleção atual.
          </p>
        </div>
        {!escopoEquipe && (
          <Link
            href="/membros/novo"
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
          >
            + Novo membro
          </Link>
        )}
      </header>

      {/* Busca + filtros recolhidos (a URL continua compartilhável). O líder
          não filtra por equipe (só vê a própria). */}
      <FiltrosMembros
        busca={busca}
        equipe={equipe}
        status={status}
        equipes={equipes}
        ocultarEquipe={escopoEquipe}
      />

      <ul className="divide-y divide-edge-soft overflow-hidden rounded-2xl border border-edge-soft vidro-leve">
        {membros.length === 0 && (
          <li className="p-6 text-center text-sm text-ink-subtle">
            Nenhum membro encontrado com estes filtros.
          </li>
        )}
        {membros.map((m) => (
          <li key={m.id}>
            <Link
              href={`/membros/${m.id}`}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2"
            >
              <PessoaHoverCard membroId={m.id} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar nome={m.nomeCompleto} fotoUrl={m.fotoUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {m.nomeCompleto}
                  </p>
                  <p className="truncate text-xs text-ink-subtle">
                    {m.equipe?.nome ?? "Sem equipe"}
                    {m.celularWhatsapp ? ` · ${m.celularWhatsapp}` : ""}
                  </p>
                </div>
              </PessoaHoverCard>
              {m.status === "inativo" && (
                <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink-soft">
                  Inativo
                </span>
              )}
              {m.status === "afastado" && (
                <span
                  className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn-text"
                  title={m.motivoStatus ?? undefined}
                >
                  Afastado
                  {m.retornoPrevisto
                    ? ` até ${m.retornoPrevisto.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`
                    : ""}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
