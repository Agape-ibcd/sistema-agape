import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { hojeSaoPaulo } from "@/lib/aniversariantes";
import { UsuariosLista } from "./UsuariosLista";

// Gestão de níveis de acesso e contas de login (exclusivo do Super Admin).
export default async function UsuariosPage() {
  const usuario = await requirePermissao("gerenciar_usuarios");

  const membros = await prisma.membro.findMany({
    // Enum declarado como super_admin→membro; "asc" põe os admins no topo.
    orderBy: [{ nivelAcesso: "asc" }, { nomeCompleto: "asc" }],
    include: { equipe: { select: { nome: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Usuários e Acessos</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Níveis de acesso (RBAC) e contas de login. Toda alteração é auditada.
        </p>
      </header>

      <UsuariosLista
        meuId={usuario.membroId}
        hojeISO={(() => {
          const h = hojeSaoPaulo();
          return `${h.ano}-${String(h.mes).padStart(2, "0")}-${String(h.dia).padStart(2, "0")}`;
        })()}
        usuarios={membros.map((m) => ({
          id: m.id,
          nomeCompleto: m.nomeCompleto,
          email: m.email,
          fotoUrl: m.fotoUrl,
          nivelAcesso: m.nivelAcesso,
          temAcesso: Boolean(m.authUserId),
          status: m.status,
          motivoStatus: m.motivoStatus,
          retornoPrevisto: m.retornoPrevisto
            ? m.retornoPrevisto.toISOString().slice(0, 10)
            : null,
          equipeNome: m.equipe?.nome ?? null,
          emailSintetico: m.email.endsWith("@membros.agape.local"),
        }))}
      />
    </div>
  );
}
