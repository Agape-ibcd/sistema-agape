import { requirePermissao } from "@/lib/auth";
import { EmConstrucao } from "@/components/EmConstrucao";

export default async function PresencaPage() {
  await requirePermissao("registrar_presenca_propria");
  return (
    <EmConstrucao
      titulo="Registrar Presença"
      etapa={4}
      descricao="Tela do líder: presença, pontualidade, justificativa, edição e exclusão lógica."
    />
  );
}
