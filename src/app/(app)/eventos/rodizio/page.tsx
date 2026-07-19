import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { formatarDataISO } from "@/lib/recorrencia";
import { domingoDaSemana, previaSemanas } from "@/lib/rodizio";
import { lerConfigRodizio } from "@/lib/aplicarRodizio";
import { RodizioForm } from "./RodizioForm";

// ─────────────────────────────────────────────────────────────────────────
// Rodízio de escalas: configuração do ciclo (editável), prévia das próximas
// semanas e aplicação num período. Regras do motor em src/lib/rodizio.ts.
// ─────────────────────────────────────────────────────────────────────────

const DIA_MS = 86_400_000;

function hojeUTC(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
}

export default async function RodizioPage() {
  await requirePermissao("gerenciar_escalas");

  const [config, equipes] = await Promise.all([
    lerConfigRodizio(),
    prisma.equipe.findMany({
      where: { status: "ativa" },
      orderBy: [{ turnoPadrao: "asc" }, { nome: "asc" }],
      select: { id: true, nome: true, turnoPadrao: true, corHex: true },
    }),
  ]);

  const hoje = hojeUTC();
  const nomePorId = new Map(equipes.map((e) => [e.id, e.nome]));
  const corPorId = new Map(equipes.map((e) => [e.id, e.corHex]));

  // Defaults para a primeira configuração: dupla por turno padrão, âncora na
  // semana corrente. O usuário revisa/edita antes de salvar.
  const manhas = equipes.filter((e) => e.turnoPadrao === "manha");
  const noites = equipes.filter((e) => e.turnoPadrao === "noite");
  const cicloInicial =
    config?.ciclo ??
    Array.from({ length: Math.max(manhas.length, noites.length, 1) }, (_, i) => ({
      manha: manhas[i % Math.max(manhas.length, 1)]?.id ?? "",
      noite: noites[i % Math.max(noites.length, 1)]?.id ?? "",
    }));

  const ancoraInicial = formatarDataISO(
    config?.semanaAncora ?? domingoDaSemana(hoje),
  );

  const previa =
    config && config.ciclo.length > 0
      ? previaSemanas(config, hoje, 6)
      : [];

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5">
        <Link href="/eventos" className="text-sm text-brand-text hover:underline">
          ← Voltar ao calendário
        </Link>
        <h1 className="mt-2 text-3xl font-display font-semibold uppercase tracking-wide text-ink">Rodízio de escalas</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Revezamento automático das equipes: aos domingos cada equipe cobre o
          seu turno; nos demais dias da semana (e nos eventos avulsos) as duas
          equipes da semana apoiam juntas.
        </p>
      </header>

      {/* Prévia das próximas semanas */}
      {previa.length > 0 && (
        <section className="mb-5 overflow-hidden rounded-2xl border border-edge-soft vidro-leve">
          <h2 className="border-b border-edge-soft px-4 py-3 text-sm font-semibold text-ink">
            Próximas semanas {config?.ativo ? "" : "· rodízio INATIVO"}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-subtle">
                <th className="px-4 py-2">Semana de</th>
                <th className="px-4 py-2">Manhã</th>
                <th className="px-4 py-2">Noite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge-soft">
              {previa.map((p) => (
                <tr key={p.domingo.toISOString()}>
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-soft">
                    {p.domingo.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      timeZone: "UTC",
                    })}
                  </td>
                  {(["manha", "noite"] as const).map((turno) => (
                    <td key={turno} className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5 text-ink">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full border border-edge-soft"
                          style={{
                            backgroundColor: corPorId.get(p.entrada[turno]) ?? "#a1a1aa",
                          }}
                        />
                        {nomePorId.get(p.entrada[turno]) ?? "—"}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <RodizioForm
        equipes={equipes.map((e) => ({
          id: e.id,
          nome: e.nome,
          turnoPadrao: e.turnoPadrao,
        }))}
        cicloInicial={cicloInicial}
        ancoraInicial={ancoraInicial}
        ativoInicial={config?.ativo ?? true}
        aplicarInicioPadrao={formatarDataISO(hoje)}
        aplicarFimPadrao={formatarDataISO(new Date(hoje.getTime() + 92 * DIA_MS))}
      />

      <div className="mt-5 rounded-2xl border border-info-edge bg-info-faint p-4 text-sm text-info-text">
        <p className="font-semibold">Como o rodízio respeita as suas edições</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            Eventos onde você montou a escala manualmente (na página do evento)
            ficam <strong>fora do rodízio</strong> — ex.: uma conferência com
            equipes específicas por culto.
          </li>
          <li>
            Para personalizar um culto que o rodízio já preencheu, basta escalar
            manualmente a equipe desejada nele (as escalas do rodízio podem ser
            removidas na página do evento).
          </li>
          <li>
            Escalas do rodízio com presença já lançada nunca são removidas.
          </li>
        </ul>
      </div>
    </div>
  );
}
