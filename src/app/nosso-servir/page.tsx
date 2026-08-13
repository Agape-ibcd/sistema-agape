import { AgapeLogo } from "@/components/AgapeLogo";
import { Rodape } from "@/components/Rodape";
import { NossoServirConteudo } from "@/components/NossoServirConteudo";

// Página PÚBLICA (sem login — ver ROTAS_PUBLICAS em
// src/lib/supabase/middleware.ts). Reaproveitada em dois lugares: o botão
// "O MINISTÉRIO ÁGAPE DA CASA DE DEUS" no e-mail de agradecimento da
// candidatura (src/lib/candidatura.ts) e o item de menu "Nosso Servir"
// (src/lib/nav.ts), visível a qualquer usuário logado.
export default function NossoServirPage() {
  return (
    <div className="agape-dots flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="vidro w-full max-w-2xl rounded-2xl p-6 sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <AgapeLogo markSize={56} />
          </div>
          <NossoServirConteudo />
        </div>
      </div>
      <Rodape />
    </div>
  );
}
