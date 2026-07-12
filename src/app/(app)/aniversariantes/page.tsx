import { requirePermissao } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import {
  aniversariantesDoMes,
  hojeSaoPaulo,
  nomeMes,
  type Aniversariante,
} from "@/lib/aniversariantes";

// Painel de aniversariantes (Etapa 5): mês corrente (com navegação), destaque
// do dia, badge D-3, idade e foto. Visível a qualquer usuário autenticado.

function idadeLabel(a: Aniversariante): string {
  if (a.idadeQueCompleta == null) return "";
  return a.ehHoje
    ? `faz ${a.idadeQueCompleta} anos`
    : a.diasAte > 0
      ? `fará ${a.idadeQueCompleta} anos`
      : `fez ${a.idadeQueCompleta} anos`;
}

function CardAniversariante({ a }: { a: Aniversariante }) {
  const passou = a.diasAte < 0;
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border p-4 ${
        a.ehHoje
          ? "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200"
          : passou
            ? "border-zinc-200 bg-white opacity-70"
            : "border-zinc-200 bg-white"
      }`}
    >
      <Avatar nome={a.nome} fotoUrl={a.fotoUrl} tamanho={48} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 truncate text-sm font-semibold text-zinc-900">
          {a.nome}
          {a.ehHoje && (
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
              Hoje 🎉
            </span>
          )}
          {a.proximoD3 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {a.diasAte === 1 ? "Amanhã" : `Em ${a.diasAte} dias`}
            </span>
          )}
        </p>
        <p className="text-xs text-zinc-500">
          {a.dataBR}
          {a.equipeNome ? ` · ${a.equipeNome}` : ""}
          {idadeLabel(a) ? ` · ${idadeLabel(a)}` : ""}
        </p>
      </div>
      <span className="shrink-0 text-right text-lg font-bold tabular-nums text-zinc-400">
        {String(a.dia).padStart(2, "0")}
      </span>
    </li>
  );
}

export default async function AniversariantesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requirePermissao("painel_aniversariantes");
  const params = await searchParams;
  const hoje = hojeSaoPaulo();

  const mesPedido = Number(params.mes);
  const mes =
    Number.isInteger(mesPedido) && mesPedido >= 1 && mesPedido <= 12
      ? mesPedido
      : hoje.mes;

  const lista = await aniversariantesDoMes(hoje, mes);
  const hojeLista = lista.filter((a) => a.ehHoje);
  const proximos = lista.filter((a) => a.proximoD3);

  const inputCls =
    "rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Aniversariantes</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {nomeMes(mes)} · {lista.length} aniversariante(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form className="flex items-center gap-2">
            <select name="mes" defaultValue={String(mes)} className={inputCls}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {nomeMes(m)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Ver
            </button>
          </form>
          <a
            href={`/api/exportar/aniversariantes?mes=${mes}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50"
          >
            Exportar (xlsx)
          </a>
        </div>
      </header>

      {/* Destaque de hoje */}
      {hojeLista.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Aniversariantes de hoje
          </h2>
          <ul className="space-y-2">
            {hojeLista.map((a) => (
              <CardAniversariante key={a.id} a={a} />
            ))}
          </ul>
        </section>
      )}

      {/* Próximos (D-3) */}
      {proximos.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-700">
            Próximos 3 dias
          </h2>
          <ul className="space-y-2">
            {proximos.map((a) => (
              <CardAniversariante key={a.id} a={a} />
            ))}
          </ul>
        </section>
      )}

      {/* Mês inteiro */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Todos de {nomeMes(mes)}
        </h2>
        {lista.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            Nenhum aniversariante em {nomeMes(mes)}.
          </div>
        ) : (
          <ul className="space-y-2">
            {lista.map((a) => (
              <CardAniversariante key={a.id} a={a} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
