import { requirePermissao } from "@/lib/auth";
import { EmConstrucao } from "@/components/EmConstrucao";

export default async function UsuariosPage() {
  await requirePermissao("gerenciar_usuarios");
  return (
    <EmConstrucao
      titulo="Usuários e Acessos"
      etapa={3}
      descricao="Gestão de contas e níveis de acesso (exclusivo do Super Administrador)."
    />
  );
}
