import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/lib/auth";
import { can, ROTULO_NIVEL } from "@/lib/rbac";
import { formatarDataISO } from "@/lib/recorrencia";
import { PerfilForm } from "./PerfilForm";
import { SenhaForm } from "./SenhaForm";
import { TelegramVinculo } from "./TelegramVinculo";

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
      fotoUrl: true,
      telegramChatId: true,
    },
  });
  // Monitor é só leitura em todo o sistema — inclusive no próprio perfil.
  const podeEditar = can(usuario.nivelAcesso, "editar_perfil_proprio");

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-semibold uppercase tracking-wide text-ink">Meu Perfil</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Dados cadastrais e informações da sua conta.
        </p>
      </header>

      <dl className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-edge-soft vidro-leve p-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-subtle">Nome</dt>
          <dd className="text-sm font-medium text-ink">
            {membro?.nomeCompleto}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-subtle">
            E-mail
          </dt>
          <dd className="text-sm font-medium text-ink">{membro?.email}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-subtle">
            Nível de acesso
          </dt>
          <dd className="text-sm font-medium text-brand-text">
            {ROTULO_NIVEL[usuario.nivelAcesso]}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-subtle">
            Equipe
          </dt>
          <dd className="text-sm font-medium text-ink">
            {usuario.equipeNome ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-subtle">
            Data de nascimento
          </dt>
          <dd className="text-sm font-medium text-ink">
            {membro?.dataNascimento
              ? membro.dataNascimento.toLocaleDateString("pt-BR", {
                  timeZone: "UTC",
                })
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-subtle">
            Celular (WhatsApp)
          </dt>
          <dd className="text-sm font-medium text-ink">
            {membro?.celularWhatsapp ?? "—"}
          </dd>
        </div>
      </dl>

      {podeEditar ? (
        <>
          <PerfilForm
            nome={membro?.nomeCompleto ?? "?"}
            fotoUrl={membro?.fotoUrl ?? null}
            celular={membro?.celularWhatsapp ?? ""}
            observacao={membro?.observacao ?? ""}
            dataNascimento={
              membro?.dataNascimento ? formatarDataISO(membro.dataNascimento) : ""
            }
          />
          <TelegramVinculo vinculado={!!membro?.telegramChatId} />
        </>
      ) : (
        <p className="rounded-2xl border border-info-edge bg-info-faint p-4 text-sm text-info-text">
          Seu nível de acesso é somente leitura — para alterar dados do seu
          cadastro (celular, observação, foto), fale com um administrador.
        </p>
      )}

      {/* Troca de senha: credencial própria — disponível a todos os níveis. */}
      <SenhaForm />
    </div>
  );
}
