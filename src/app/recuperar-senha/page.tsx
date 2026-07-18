import { AgapeLogo } from "@/components/AgapeLogo";
import { Rodape } from "@/components/Rodape";
import { RecuperarSenhaFluxo } from "./RecuperarSenhaFluxo";

// Página PÚBLICA (sem sessão — ver ROTAS_PUBLICAS em
// src/lib/supabase/middleware.ts). Recuperação de senha por código
// (e-mail/Telegram). Mesmo enquadramento visual do /login.
export default function RecuperarSenhaPage() {
  return (
    <div className="agape-dots flex min-h-screen flex-col bg-surface-2">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <AgapeLogo markSize={64} />
            <p className="mt-3 text-sm text-ink-subtle">
              Igreja Batista Casa de Deus · Jundiaí/SP
            </p>
          </div>
          <RecuperarSenhaFluxo />
        </div>
      </div>
      <Rodape />
    </div>
  );
}
