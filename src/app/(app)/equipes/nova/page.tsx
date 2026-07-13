import Link from "next/link";
import { requirePermissao } from "@/lib/auth";
import { EquipeForm } from "../EquipeForm";

export default async function NovaEquipePage() {
  await requirePermissao("gerenciar_membros");

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <Link href="/equipes" className="text-sm text-brand-text hover:underline">
          ← Equipes
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-ink">Nova equipe</h1>
      </header>
      <EquipeForm equipe={null} />
    </div>
  );
}
