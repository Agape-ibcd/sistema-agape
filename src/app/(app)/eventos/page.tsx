import { requirePermissao } from "@/lib/auth";
import { EmConstrucao } from "@/components/EmConstrucao";

export default async function EventosPage() {
  await requirePermissao("gerenciar_escalas");
  return (
    <EmConstrucao
      titulo="Eventos e Escalas"
      etapa={3}
      descricao="Tipos de evento com recorrência, calendário e escala das equipes."
    />
  );
}
