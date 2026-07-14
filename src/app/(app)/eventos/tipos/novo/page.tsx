import Link from "next/link";
import { requirePermissao } from "@/lib/auth";
import { TipoEventoForm } from "../TipoEventoForm";

export default async function NovoTipoEventoPage() {
  await requirePermissao("gerenciar_tipos_evento");

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <Link href="/eventos/tipos" className="text-sm text-brand-text hover:underline">
          ← Tipos de evento
        </Link>
        <h1 className="mt-1 text-3xl font-display font-semibold uppercase tracking-wide text-ink">Novo tipo de evento</h1>
      </header>
      <TipoEventoForm tipo={null} />
    </div>
  );
}
