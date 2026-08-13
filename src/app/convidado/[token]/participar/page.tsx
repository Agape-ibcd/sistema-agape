import { buscarConvitePorToken } from "@/lib/candidatura";
import { AgapeLogo } from "@/components/AgapeLogo";
import { Rodape } from "@/components/Rodape";
import { CandidaturaForm } from "./CandidaturaForm";

// Página PÚBLICA (sem login). Formulário de candidatura — só acessível com
// um token de convite ainda válido (o link explicativo em /convidado/[token]
// leva aqui depois de rolar o texto até o fim).
export default async function ParticiparPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resultado = await buscarConvitePorToken(token);

  return (
    <div className="agape-dots flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="vidro w-full max-w-xl rounded-2xl p-6">
          <div className="mb-6 flex flex-col items-center text-center">
            <AgapeLogo markSize={56} />
          </div>

          {!resultado.valido ? (
            <p className="text-center text-sm text-ink-soft">{resultado.motivo}</p>
          ) : (
            <>
              <h1 className="text-center text-lg font-semibold text-ink">
                Quero participar do Ministério Ágape
              </h1>
              <p className="mt-2 text-center text-sm text-ink-soft">
                Preencha seus dados abaixo — todos os campos são obrigatórios.
              </p>
              <div className="mt-6">
                <CandidaturaForm token={token} />
              </div>
            </>
          )}
        </div>
      </div>
      <Rodape />
    </div>
  );
}
