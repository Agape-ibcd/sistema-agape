import { requirePermissao } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import {
  aniversariantesDoMes,
  hojeSaoPaulo,
  nomeMes,
  type Aniversariante,
} from "@/lib/aniversariantes";
import { SeletorMes } from "./SeletorMes";
import { CartaoAniversario } from "./CartaoAniversario";

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
          ? "border-brand-edge bg-brand-faint ring-1 ring-brand-ring"
          : passou
            ? "border-edge-soft bg-surface opacity-70"
            : "border-edge-soft bg-surface"
      }`}
    >
      <Avatar nome={a.nome} fotoUrl={a.fotoUrl} tamanho={48} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 truncate text-sm font-semibold text-ink">
          {a.nome}
          {a.ehHoje && (
            <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">
              Hoje 🎉
            </span>
          )}
          {a.proximoD3 && (
            <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn-text">
              {a.diasAte === 1 ? "Amanhã" : `Em ${a.diasAte} dias`}
            </span>
          )}
        </p>
        <p className="text-xs text-ink-subtle">
          {a.dataBR}
          {a.equipeNome ? ` · ${a.equipeNome}` : ""}
          {idadeLabel(a) ? ` · ${idadeLabel(a)}` : ""}
        </p>
      </div>
      <CartaoAniversario
        dados={{
          nome: a.nome,
          fotoUrl: a.fotoUrl,
          dataBR: a.dataBR,
          idadeQueCompleta: a.idadeQueCompleta,
        }}
      />
      <span className="shrink-0 text-right text-lg font-bold tabular-nums text-ink-faint">
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

  const nomesMeses = Array.from({ length: 12 }, (_, i) => nomeMes(i + 1));

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Aniversariantes</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {nomeMes(mes)} · {lista.length} aniversariante(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SeletorMes mes={mes} nomesMeses={nomesMeses} />
          <a
            href={`/api/exportar/aniversariantes?mes=${mes}`}
            className="rounded-lg border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-brand-edge hover:bg-brand-faint"
          >
            Exportar (xlsx)
          </a>
        </div>
      </header>

      {/* Destaque de hoje */}
      {hojeLista.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-text">
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
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-warn-text">
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
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-subtle">
          Todos de {nomeMes(mes)}
        </h2>
        {lista.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-edge bg-surface p-8 text-center text-sm text-ink-subtle">
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
