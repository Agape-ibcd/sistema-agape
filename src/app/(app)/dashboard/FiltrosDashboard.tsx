"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { formatarDataISO } from "@/lib/recorrencia";
import { PERIODOS, intervaloPeriodo, type PeriodoId } from "@/lib/periodos";
import { Popover } from "@/components/Popover";
import type {
  EscopoDashboard,
  FiltrosDashboard as Filtros,
  OpcoesFiltro,
} from "@/lib/dashboard";

// Barra de filtros globais (período, equipe, tipo de culto, membro), recolhida
// em dois botões — "Período" e "Filtros" — para não poluir a tela de botões/
// campos, especialmente no celular. Aplica automaticamente ao alterar cada
// campo (sem botão "Aplicar"); navega por querystring (URL compartilhável, os
// mesmos parâmetros alimentam as exportações). Seletores de equipe/membro são
// ocultados quando o escopo já os fixa.

export function FiltrosDashboard({
  filtros,
  opcoes,
  escopo,
}: {
  filtros: Filtros;
  opcoes: OpcoesFiltro;
  escopo: EscopoDashboard;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  // Monta a querystring a partir do estado atual do formulário (campos vazios
  // são omitidos → o servidor cai no padrão) e navega.
  function aplicar(form: HTMLFormElement) {
    const p = new URLSearchParams();
    for (const [chave, valor] of new FormData(form).entries()) {
      const v = String(valor).trim();
      if (v) p.set(chave, v);
    }
    const qs = p.toString();
    iniciar(() => router.push(qs ? `/dashboard?${qs}` : "/dashboard"));
  }

  const inicioAtual = formatarDataISO(filtros.inicio);
  const fimAtual = formatarDataISO(filtros.fim);

  // Aplica um período pré-configurado, preservando equipe/tipo/membro atuais.
  function aplicarPeriodo(id: PeriodoId) {
    const { inicio, fim } = intervaloPeriodo(id);
    const p = new URLSearchParams();
    p.set("inicio", formatarDataISO(inicio));
    p.set("fim", formatarDataISO(fim));
    if (filtros.equipeId) p.set("equipe", filtros.equipeId);
    if (filtros.tipoEventoId) p.set("tipo", filtros.tipoEventoId);
    if (filtros.membroId) p.set("membro", filtros.membroId);
    iniciar(() => router.push(`/dashboard?${p.toString()}`));
  }

  // Marca o preset cujo intervalo bate com o período atualmente aplicado.
  function ehAtivo(id: PeriodoId): boolean {
    const { inicio, fim } = intervaloPeriodo(id);
    return (
      formatarDataISO(inicio) === inicioAtual &&
      formatarDataISO(fim) === fimAtual
    );
  }
  const presetAtivo = PERIODOS.find((p) => ehAtivo(p.id));
  const rotuloPeriodo = presetAtivo
    ? presetAtivo.rotulo
    : `${inicioAtual.split("-").reverse().join("/")} – ${fimAtual.split("-").reverse().join("/")}`;

  // Rechaveia o form quando os filtros resolvidos mudam, para os campos
  // (não controlados) refletirem a URL — inclusive ao "Limpar".
  const chave = [inicioAtual, fimAtual, filtros.equipeId ?? "", filtros.tipoEventoId ?? "", filtros.membroId ?? ""].join("|");

  const inputCls =
    "w-full rounded-xl border border-edge px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";
  const labelCls = "flex flex-col gap-1 text-xs font-medium text-ink-soft";

  const mostrarEquipe = escopo === "geral";
  const mostrarMembro = escopo !== "proprio";

  const qtdFiltrosAtivos =
    (mostrarEquipe && filtros.equipeId ? 1 : 0) +
    (filtros.tipoEventoId ? 1 : 0) +
    (mostrarMembro && filtros.membroId ? 1 : 0);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {/* Período: um botão mostrando o preset ativo (ou o intervalo, se
          personalizado); o painel lista os presets pré-configurados. */}
      <Popover rotulo={`Período: ${rotuloPeriodo}`}>
        {(fechar) => (
          <div className="flex flex-col gap-1">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  aplicarPeriodo(p.id);
                  fechar();
                }}
                aria-current={ehAtivo(p.id)}
                className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  ehAtivo(p.id)
                    ? "bg-brand text-white"
                    : "text-ink-soft hover:bg-surface-2"
                }`}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
        )}
      </Popover>

      {/* Filtros: datas personalizadas + equipe/tipo/membro, recolhidos num
          único painel. O selo mostra quantos filtros opcionais estão ativos. */}
      <Popover rotulo="Filtros" badge={qtdFiltrosAtivos}>
        {() => (
          <form
            key={chave}
            onChange={(e) => aplicar(e.currentTarget)}
            onSubmit={(e) => {
              e.preventDefault();
              aplicar(e.currentTarget);
            }}
            className={`flex flex-col gap-3 transition-opacity ${pendente ? "opacity-60" : ""}`}
          >
            <div className="grid grid-cols-2 gap-2">
              <label className={labelCls}>
                Início
                <input
                  type="date"
                  name="inicio"
                  defaultValue={inicioAtual}
                  className={inputCls}
                />
              </label>
              <label className={labelCls}>
                Fim
                <input
                  type="date"
                  name="fim"
                  defaultValue={fimAtual}
                  className={inputCls}
                />
              </label>
            </div>

            {mostrarEquipe && (
              <label className={labelCls}>
                Equipe
                <select
                  name="equipe"
                  defaultValue={filtros.equipeId ?? ""}
                  className={inputCls}
                >
                  <option value="">Todas as equipes</option>
                  {opcoes.equipes.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className={labelCls}>
              Tipo de culto
              <select
                name="tipo"
                defaultValue={filtros.tipoEventoId ?? ""}
                className={inputCls}
              >
                <option value="">Todos os tipos</option>
                {opcoes.tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </label>

            {mostrarMembro && (
              <label className={labelCls}>
                Membro
                <select
                  name="membro"
                  defaultValue={filtros.membroId ?? ""}
                  className={inputCls}
                >
                  <option value="">Todos os membros</option>
                  {opcoes.membros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex items-center justify-between border-t border-edge-soft pt-2.5">
              <span
                className="text-xs text-ink-faint"
                aria-live="polite"
                aria-busy={pendente}
              >
                {pendente ? "Atualizando…" : ""}
              </span>
              <button
                type="button"
                onClick={() => iniciar(() => router.push("/dashboard"))}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-soft underline-offset-2 hover:text-danger-text hover:underline"
              >
                Limpar todos os filtros
              </button>
            </div>
          </form>
        )}
      </Popover>
    </div>
  );
}
