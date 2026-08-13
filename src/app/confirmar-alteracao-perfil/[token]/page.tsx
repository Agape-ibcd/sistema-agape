import { prisma } from "@/lib/prisma";
import { AgapeLogo } from "@/components/AgapeLogo";
import { Rodape } from "@/components/Rodape";
import { ConfirmarAlteracaoForm } from "./ConfirmarAlteracaoForm";

// Página PÚBLICA (sem login — ver ROTAS_PUBLICAS em
// src/lib/supabase/middleware.ts). Link enviado por e-mail/Telegram ao
// pedir a alteração em /perfil (src/lib/alteracaoPerfil.ts). A segurança é
// o token opaco com expiração de 24h, não sessão de usuário.
export default async function ConfirmarAlteracaoPerfilPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const pedido = await prisma.alteracaoPerfilPendente.findUnique({
    where: { token },
    include: { membro: { select: { nomeCompleto: true } } },
  });

  const expirado = pedido ? pedido.expiraEm < new Date() : false;

  return (
    <div className="agape-dots flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="vidro w-full max-w-md rounded-2xl p-6">
          <div className="mb-6 flex flex-col items-center text-center">
            <AgapeLogo markSize={56} />
          </div>

          {!pedido ? (
            <p className="text-center text-sm text-ink-soft">
              Link inválido. Se você recebeu este link por e-mail ou
              Telegram, confira se copiou o endereço completo.
            </p>
          ) : pedido.usado ? (
            <p className="rounded-xl bg-info-faint px-4 py-3 text-center text-sm font-medium text-info-text">
              Este link já foi usado (ou substituído por um pedido mais
              recente).
            </p>
          ) : expirado ? (
            <p className="text-center text-sm text-ink-soft">
              Este link expirou — volte ao seu perfil no sistema e peça a
              alteração de novo.
            </p>
          ) : (
            <>
              <h1 className="text-center text-lg font-semibold text-ink">
                Olá, {pedido.membro.nomeCompleto.split(" ")[0]}!
              </h1>
              <p className="mt-2 text-center text-sm text-ink-soft">
                Confirme a alteração do seu cadastro no Sistema Ágape:
              </p>

              <dl className="mt-4 space-y-2 rounded-xl border border-edge-soft bg-surface-2 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-subtle">Nome</dt>
                  <dd className="text-right font-medium text-ink">{pedido.nomeCompleto}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-subtle">E-mail</dt>
                  <dd className="text-right font-medium text-ink">{pedido.email}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-subtle">Celular</dt>
                  <dd className="text-right font-medium text-ink">
                    {pedido.celularWhatsapp ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-subtle">Nascimento</dt>
                  <dd className="text-right font-medium text-ink">
                    {pedido.dataNascimento
                      ? pedido.dataNascimento.toLocaleDateString("pt-BR", { timeZone: "UTC" })
                      : "—"}
                  </dd>
                </div>
              </dl>

              <ConfirmarAlteracaoForm token={token} />
            </>
          )}
        </div>
      </div>
      <Rodape />
    </div>
  );
}
