import { requirePermissao } from "@/lib/auth";
import { EmConstrucao } from "@/components/EmConstrucao";

export default async function AniversariantesPage() {
  await requirePermissao("painel_aniversariantes");
  return (
    <EmConstrucao
      titulo="Aniversariantes"
      etapa={5}
      descricao="Aniversariantes do mês, destaque do dia, alerta D-3 e idade."
    />
  );
}
