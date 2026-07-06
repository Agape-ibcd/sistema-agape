import { requirePermissao } from "@/lib/auth";
import { EmConstrucao } from "@/components/EmConstrucao";

export default async function EquipesPage() {
  await requirePermissao("gerenciar_membros");
  return (
    <EmConstrucao
      titulo="Equipes"
      etapa={3}
      descricao="Gestão de equipes, associação de líderes e membros."
    />
  );
}
