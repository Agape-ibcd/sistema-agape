import { requireUsuario } from "@/lib/auth";
import { ConviteForm } from "./ConviteForm";

// Primeiro item do menu (pedido do usuário): qualquer pessoa logada pode
// convidar alguém para o Ministério — compartilhando um link ou enviando
// por e-mail. Ver src/lib/candidatura.ts (gerarConvite) e /solicitacoes
// (onde Super Admin/Admin acompanham os convites gerados e as candidaturas).
export default async function ConvitePage() {
  await requireUsuario();

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-semibold uppercase tracking-wide text-ink">
          Convite ao Ministério
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Convide alguém para conhecer e participar do Ministério Ágape.
        </p>
      </header>

      <ConviteForm />
    </div>
  );
}
