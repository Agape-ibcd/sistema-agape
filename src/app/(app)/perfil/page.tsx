import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/lib/auth";
import { ROTULO_NIVEL } from "@/lib/rbac";
import { PerfilForm } from "./PerfilForm";

export default async function PerfilPage() {
  const usuario = await requireUsuario();
  const membro = await prisma.membro.findUnique({
    where: { id: usuario.membroId },
    select: {
      nomeCompleto: true,
      email: true,
      celularWhatsapp: true,
      observacao: true,
      dataNascimento: true,
    },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Meu Perfil</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Dados cadastrais e informações da sua conta.
        </p>
      </header>

      <dl className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Nome</dt>
          <dd className="text-sm font-medium text-zinc-900">
            {membro?.nomeCompleto}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">
            E-mail
          </dt>
          <dd className="text-sm font-medium text-zinc-900">{membro?.email}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">
            Nível de acesso
          </dt>
          <dd className="text-sm font-medium text-emerald-700">
            {ROTULO_NIVEL[usuario.nivelAcesso]}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">
            Equipe
          </dt>
          <dd className="text-sm font-medium text-zinc-900">
            {usuario.equipeNome ?? "—"}
          </dd>
        </div>
      </dl>

      <PerfilForm
        celular={membro?.celularWhatsapp ?? ""}
        observacao={membro?.observacao ?? ""}
      />
    </div>
  );
}
