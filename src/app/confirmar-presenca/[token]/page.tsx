import { prisma } from "@/lib/prisma";
import { AgapeLogo } from "@/components/AgapeLogo";
import { Rodape } from "@/components/Rodape";
import { ConfirmarPresencaForm } from "./ConfirmarPresencaForm";

// Página PÚBLICA (sem login — ver ROTAS_PUBLICAS em
// src/lib/supabase/middleware.ts). Link enviado por e-mail/Telegram no
// gatilho `nova_escala` (src/lib/notificacoesEnvio.ts). A segurança é o
// token opaco com expiração (fim do dia do evento), não sessão de usuário.
export default async function ConfirmarPresencaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const confirmacao = await prisma.confirmacaoEscala.findUnique({
    where: { token },
    include: {
      membro: { select: { nomeCompleto: true } },
      escala: {
        include: {
          equipe: { select: { nome: true } },
          evento: { include: { tipoEvento: { select: { nome: true } } } },
        },
      },
    },
  });

  const expirado = confirmacao ? confirmacao.expiraEm < new Date() : false;

  return (
    <div className="agape-dots flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="vidro w-full max-w-md rounded-2xl p-6">
          <div className="mb-6 flex flex-col items-center text-center">
            <AgapeLogo markSize={56} />
          </div>

          {!confirmacao ? (
            <p className="text-center text-sm text-ink-soft">
              Link inválido. Se você recebeu este link por e-mail ou Telegram,
              confira se copiou o endereço completo.
            </p>
          ) : expirado && confirmacao.status === "pendente" ? (
            <p className="text-center text-sm text-ink-soft">
              Este link expirou — fale com a liderança da sua equipe se ainda
              precisar confirmar.
            </p>
          ) : (
            <>
              <h1 className="text-center text-lg font-semibold text-ink">
                Olá, {confirmacao.membro.nomeCompleto.split(" ")[0]}!
              </h1>
              <p className="mt-2 text-center text-sm text-ink-soft">
                Você foi escalado(a) na equipe{" "}
                <strong>{confirmacao.escala.equipe.nome}</strong> para:
              </p>
              <p className="mt-1 text-center text-base font-medium text-ink">
                {confirmacao.escala.evento.descricaoEspecifica ??
                  confirmacao.escala.evento.tipoEvento.nome}
              </p>
              <p className="text-center text-sm text-ink-subtle">
                {confirmacao.escala.evento.dataEvento.toLocaleDateString("pt-BR", {
                  timeZone: "UTC",
                })}{" "}
                às {confirmacao.escala.evento.horarioInicio}
              </p>

              {confirmacao.status !== "pendente" ? (
                <p
                  className={`mt-6 rounded-xl px-4 py-3 text-center text-sm font-medium ${
                    confirmacao.status === "confirmado"
                      ? "bg-success-faint text-success-text"
                      : "bg-danger-faint text-danger-text"
                  }`}
                >
                  {confirmacao.status === "confirmado"
                    ? "Você já confirmou presença. Obrigado!"
                    : "Você já informou que não poderá comparecer."}
                </p>
              ) : (
                <ConfirmarPresencaForm token={token} />
              )}
            </>
          )}
        </div>
      </div>
      <Rodape />
    </div>
  );
}
