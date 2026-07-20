import { redirect } from "next/navigation";
import { requireUsuario } from "@/lib/auth";
import { Rodape } from "@/components/Rodape";
import { AgapeLogo } from "@/components/AgapeLogo";
import { TrocarSenhaForm } from "./TrocarSenhaForm";

// Tela obrigatória de troca de senha. O layout do route group (app) redireciona
// para cá quem tem `deveTrocarSenha=true` (credenciais provisórias enviadas
// pelo super_admin). Fica FORA de (app) para não cair no próprio guard.
export default async function TrocarSenhaPage() {
  const usuario = await requireUsuario();
  // Quem não precisa trocar não fica preso aqui.
  if (!usuario.deveTrocarSenha) redirect("/dashboard");

  return (
    <div className="agape-dots flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <AgapeLogo markSize={72} />
            <h1 className="mt-4 text-xl font-display font-semibold uppercase tracking-wide text-ink">
              Defina sua senha
            </h1>
            <p className="mt-2 text-sm text-ink-subtle">
              Você entrou com uma senha provisória. Para continuar, crie uma
              senha pessoal — só você deve conhecê-la.
            </p>
          </div>

          <TrocarSenhaForm />
        </div>
      </div>
      <Rodape />
    </div>
  );
}
