import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import {
  descreverRecorrencia,
  type ConfigRecorrencia,
} from "@/lib/recorrencia";
import { GerarEventosBotao } from "./GerarEventosBotao";

const ROTULO_CATEGORIA: Record<string, string> = {
  culto_regular: "Culto regular",
  evento_extra: "Evento extra",
  campanha: "Campanha",
  conferencia: "Conferência",
  batismo: "Batismo",
  outro: "Outro",
};

export default async function TiposEventoPage() {
  await requirePermissao("gerenciar_tipos_evento");

  const tipos = await prisma.tipoEvento.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    include: { _count: { select: { eventos: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <Link href="/eventos" className="text-sm text-emerald-700 hover:underline">
          ← Calendário
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Tipos de evento</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Modelos recorrentes que alimentam o calendário.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <GerarEventosBotao />
            <Link
              href="/eventos/tipos/novo"
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              + Novo tipo
            </Link>
          </div>
        </div>
      </header>

      <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {tipos.length === 0 && (
          <li className="p-6 text-center text-sm text-zinc-500">
            Nenhum tipo de evento cadastrado.
          </li>
        )}
        {tipos.map((t) => (
          <li key={t.id}>
            <Link
              href={`/eventos/tipos/${t.id}`}
              className="flex items-center gap-4 px-4 py-3 transition hover:bg-zinc-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">{t.nome}</p>
                <p className="truncate text-xs text-zinc-500">
                  {descreverRecorrencia(
                    t.tipoRecorrencia,
                    (t.configRecorrencia ?? {}) as ConfigRecorrencia,
                  )}
                  {" · "}
                  {ROTULO_CATEGORIA[t.categoria] ?? t.categoria}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-zinc-900">
                  {t.horarioInicio}
                </p>
                <p className="text-xs text-zinc-500">chegada {t.horarioChegadaEquipe}</p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-zinc-900">
                  {t._count.eventos}
                </p>
                <p className="text-xs text-zinc-500">evento(s)</p>
              </div>
              {!t.ativo && (
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">
                  Inativo
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-zinc-500">
        &quot;Gerar eventos&quot; cria as instâncias dos próximos 3 meses respeitando a
        recorrência de cada tipo ativo. A operação é idempotente: eventos já
        existentes (inclusive editados ou cancelados) não são tocados.
      </p>
    </div>
  );
}
