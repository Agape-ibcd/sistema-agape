import Link from "next/link";
import { requirePermissao } from "@/lib/auth";
import { TipoEventoForm } from "../TipoEventoForm";

export default async function NovoTipoEventoPage() {
  await requirePermissao("gerenciar_tipos_evento");

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <Link href="/eventos/tipos" className="text-sm text-emerald-700 hover:underline">
          ← Tipos de evento
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">Novo tipo de evento</h1>
      </header>
      <TipoEventoForm tipo={null} />
    </div>
  );
}
