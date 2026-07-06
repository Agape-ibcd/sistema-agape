export function EmConstrucao({
  titulo,
  etapa,
  descricao,
}: {
  titulo: string;
  etapa: number;
  descricao: string;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">{titulo}</h1>
        <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
          Etapa {etapa}
        </span>
      </header>
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
        <p className="text-sm text-zinc-600">{descricao}</p>
        <p className="mt-2 text-xs text-zinc-400">
          Módulo previsto para a Etapa {etapa} do plano de construção.
        </p>
      </div>
    </div>
  );
}
