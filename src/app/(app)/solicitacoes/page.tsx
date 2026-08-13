import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { CandidaturaCard, type CandidaturaDados } from "./CandidaturaCard";
import { ConvitesLista, type ConviteDados } from "./ConvitesLista";

const ROTULO_STATUS: Record<string, string> = {
  pendente: "Pendentes",
  aprovado: "Aprovadas",
  reprovado: "Reprovadas",
};

function mesAno(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC", month: "2-digit", year: "numeric" });
}

// Painel de aprovação do Convite ao Ministério. Duas abas:
//   • Candidaturas — decidir (aprovar/reprovar) quem enviou o formulário.
//   • Convites — TODOS os convites gerados por qualquer usuário, com quem
//     gerou e quanto tempo falta para expirar (pedido do usuário: o Admin
//     precisa enxergar isso assim que o convite é criado, não só quando vira
//     candidatura).
export default async function SolicitacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; status?: string }>;
}) {
  await requirePermissao("aprovar_candidaturas");
  const { aba: abaParam, status: statusParam } = await searchParams;
  const aba = abaParam === "convites" ? "convites" : "candidaturas";
  const status = ["pendente", "aprovado", "reprovado"].includes(statusParam ?? "")
    ? (statusParam as "pendente" | "aprovado" | "reprovado")
    : "pendente";

  const tabCls = (ativa: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-medium ${
      ativa ? "bg-brand text-white" : "text-ink-soft hover:bg-surface-2"
    }`;

  if (aba === "convites") {
    const convitesRaw = await prisma.conviteMinisterio.findMany({
      orderBy: { criadoEm: "desc" },
      include: {
        criadoPor: { select: { nomeCompleto: true } },
        _count: { select: { candidaturas: true } },
      },
    });
    const convites: ConviteDados[] = convitesRaw.map((c) => ({
      id: c.id,
      criadoPorNome: c.criadoPor.nomeCompleto,
      origem: c.origem,
      emailConvidado: c.emailConvidado,
      criadoEm: c.criadoEm.toLocaleDateString("pt-BR"),
      expiraEmISO: c.expiraEm.toISOString(),
      qtdCandidaturas: c._count.candidaturas,
    }));

    return (
      <div className="mx-auto max-w-3xl">
        <Cabecalho aba={aba} tabCls={tabCls} />
        <ConvitesLista convites={convites} />
      </div>
    );
  }

  const [candidaturasRaw, equipes] = await Promise.all([
    prisma.candidaturaMembro.findMany({
      where: { status },
      orderBy: { criadoEm: "desc" },
      include: { convite: { include: { criadoPor: { select: { nomeCompleto: true } } } } },
    }),
    prisma.equipe.findMany({ where: { status: "ativa" }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const candidaturas: CandidaturaDados[] = candidaturasRaw.map((c) => ({
    id: c.id,
    nomeCompleto: c.nomeCompleto,
    email: c.email,
    celularWhatsapp: c.celularWhatsapp,
    dataNascimento: c.dataNascimento.toLocaleDateString("pt-BR", { timeZone: "UTC" }),
    fotoUrl: c.fotoUrl,
    membroDesde: mesAno(c.membroDesde),
    fezCursoMnv: c.fezCursoMnv,
    mnvConclusao: c.mnvConclusao ? mesAno(c.mnvConclusao) : null,
    alunoEscolaBiblica: c.alunoEscolaBiblica,
    participaOutroMinisterio: c.participaOutroMinisterio,
    quaisMinisterios: c.quaisMinisterios,
    cultoDomingoManha: c.cultoDomingoManha,
    cultoDomingoNoite: c.cultoDomingoNoite,
    disponibilidadeSemana: c.disponibilidadeSemana,
    status: c.status,
    motivoReprovacao: c.motivoReprovacao,
    convidadoPorNome: c.convite.criadoPor.nomeCompleto,
    criadoEm: c.criadoEm.toLocaleDateString("pt-BR"),
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <Cabecalho aba={aba} tabCls={tabCls} />

      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(ROTULO_STATUS).map(([valor, rotulo]) => (
          <Link
            key={valor}
            href={`/solicitacoes?aba=candidaturas&status=${valor}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              status === valor
                ? "border-brand bg-brand-soft text-brand-text"
                : "border-edge text-ink-soft hover:bg-surface-2"
            }`}
          >
            {rotulo}
          </Link>
        ))}
      </div>

      {candidaturas.length === 0 ? (
        <p className="rounded-2xl border border-edge-soft vidro-leve p-6 text-center text-sm text-ink-subtle">
          Nenhuma candidatura {ROTULO_STATUS[status].toLowerCase()}.
        </p>
      ) : (
        <div className="space-y-4">
          {candidaturas.map((c) => (
            <CandidaturaCard key={c.id} candidatura={c} equipes={equipes} />
          ))}
        </div>
      )}
    </div>
  );
}

function Cabecalho({
  aba,
  tabCls,
}: {
  aba: "candidaturas" | "convites";
  tabCls: (ativa: boolean) => string;
}) {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-3xl font-display font-semibold uppercase tracking-wide text-ink">
          Solicitações
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Candidaturas ao Ministério e convites gerados pelos usuários.
        </p>
      </header>

      <div className="mb-4 flex gap-2 rounded-xl border border-edge-soft vidro-leve p-1">
        <Link href="/solicitacoes?aba=candidaturas" className={tabCls(aba === "candidaturas")}>
          Candidaturas
        </Link>
        <Link href="/solicitacoes?aba=convites" className={tabCls(aba === "convites")}>
          Convites
        </Link>
      </div>
    </>
  );
}
