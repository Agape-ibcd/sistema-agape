import { requireUsuario } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ROTULO_NIVEL } from "@/lib/rbac";
import { ITENS_MENU } from "@/lib/nav";
import { AppShell } from "@/components/AppShell";
import { carregarNotificacoes } from "@/lib/notificacoes";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await requireUsuario();

  // Menu filtrado pelo nível de acesso do usuário.
  const itens = ITENS_MENU.filter(
    (item) => !item.permissao || can(usuario.nivelAcesso, item.permissao),
  );

  const notificacoes = await carregarNotificacoes(usuario);

  return (
    <AppShell
      itens={itens}
      usuario={{
        nome: usuario.nomeCompleto,
        nivelRotulo: ROTULO_NIVEL[usuario.nivelAcesso],
        equipe: usuario.equipeNome,
        fotoUrl: usuario.fotoUrl,
      }}
      notificacoes={notificacoes}
    >
      {children}
    </AppShell>
  );
}
