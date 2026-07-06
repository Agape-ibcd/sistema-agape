import { requirePermissao } from "@/lib/auth";
import { EmConstrucao } from "@/components/EmConstrucao";

export default async function MembrosPage() {
  await requirePermissao("gerenciar_membros");
  return (
    <EmConstrucao
      titulo="Membros"
      etapa={3}
      descricao="Cadastro de membros com foto, busca, filtros e inativação."
    />
  );
}
