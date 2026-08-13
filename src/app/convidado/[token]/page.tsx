import { buscarConvitePorToken } from "@/lib/candidatura";
import { AgapeLogo } from "@/components/AgapeLogo";
import { Rodape } from "@/components/Rodape";
import { ExplicacaoMinisterio } from "./ExplicacaoMinisterio";

// Página PÚBLICA (sem login — ver ROTAS_PUBLICAS em
// src/lib/supabase/middleware.ts). Link gerado em /convite (compartilhado
// ou por e-mail) — a segurança é o token opaco com expiração, não sessão.
export default async function ConvidadoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resultado = await buscarConvitePorToken(token);

  return (
    <div className="agape-dots flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="vidro w-full max-w-lg rounded-2xl p-6">
          <div className="mb-6 flex flex-col items-center text-center">
            <AgapeLogo markSize={56} />
          </div>

          {!resultado.valido ? (
            <p className="text-center text-sm text-ink-soft">{resultado.motivo}</p>
          ) : (
            <>
              <h1 className="text-center text-lg font-semibold text-ink">
                Bem-vindo(a) ao Ministério Ágape!
              </h1>
              <p className="mt-1 text-center text-xs text-ink-subtle">
                Convite de {resultado.convite.criadoPor.nomeCompleto}
              </p>

              <div className="mt-5">
                {/* Resumo de duas frases do e-mail de convite (pedido do
                    usuário em 2026-08-13) — ver src/lib/candidatura.ts. */}
                <ExplicacaoMinisterio token={token}>
                  <p>
                    Nós somos o ministério de acolhimento da igreja,
                    responsáveis por receber nossos irmãos e visitantes com
                    amor, excelência e sorriso de Cristo.
                  </p>
                  <p>Gostaríamos muito de ter você servindo ao Senhor conosco.</p>
                </ExplicacaoMinisterio>
              </div>
            </>
          )}
        </div>
      </div>
      <Rodape />
    </div>
  );
}
