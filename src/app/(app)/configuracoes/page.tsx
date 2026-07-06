import { requirePermissao } from "@/lib/auth";
import { EmConstrucao } from "@/components/EmConstrucao";

export default async function ConfiguracoesPage() {
  await requirePermissao("configuracoes_sistema");
  return (
    <EmConstrucao
      titulo="Configurações"
      etapa={6}
      descricao="Parâmetros do sistema, notificações e integrações."
    />
  );
}
