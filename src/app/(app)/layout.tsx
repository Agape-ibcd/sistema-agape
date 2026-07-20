import { redirect } from "next/navigation";
import { requireUsuario } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ROTULO_NIVEL } from "@/lib/rbac";
import { ITENS_MENU, itemVisivel } from "@/lib/nav";
import { AppShell } from "@/components/AppShell";
import { SWRProvider } from "@/components/SWRProvider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await requireUsuario();

  // Senha provisória enviada pelo super_admin: o membro precisa definir uma
  // senha nova antes de usar qualquer tela do sistema. /trocar-senha fica FORA
  // do route group (app), então não cai neste guard (sem loop de redirect).
  if (usuario.deveTrocarSenha) redirect("/trocar-senha");

  // Menu filtrado pelo nível de acesso do usuário.
  const itens = ITENS_MENU.filter((item) =>
    itemVisivel(item, (p) => can(usuario.nivelAcesso, p)),
  );

  return (
    <SWRProvider cacheKey={usuario.membroId}>
      <AppShell
        itens={itens}
        usuario={{
          nome: usuario.nomeCompleto,
          nivelRotulo: ROTULO_NIVEL[usuario.nivelAcesso],
          equipe: usuario.equipeNome,
          fotoUrl: usuario.fotoUrl,
        }}
      >
        {children}
      </AppShell>
    </SWRProvider>
  );
}
