"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { NivelAcesso, CanalNotificacao, GatilhoNotificacao } from "@prisma/client";
import { salvarConfigNotificacao, enviarNotificacaoManual } from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";

const ROTULO_NIVEL: Record<NivelAcesso, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  monitor: "Monitor",
  lider: "Líder",
  membro: "Membro",
};
const NIVEIS: NivelAcesso[] = ["super_admin", "admin", "monitor", "lider", "membro"];

export type RegraDados = {
  id: string;
  gatilho: GatilhoNotificacao;
  titulo: string;
  descricao: string;
  implementado: boolean;
  ativo: boolean;
  niveisAlvo: NivelAcesso[];
  canais: CanalNotificacao[];
  assunto: string | null;
  mensagem: string | null;
  horarioEnvio: string | null;
  usaHorario: boolean;
  // nova_escala/escala_alterada notificam TODOS os escalados, sem filtrar
  // por nível — o seletor de níveis-alvo não faz sentido pra eles.
  usaNiveisAlvo: boolean;
  // Texto do aviso de destinatários (quando usaNiveisAlvo=false). Padrão =
  // "membros escalados"; gatilhos de edição informam os supervisores.
  avisoDestinatarios?: string;
  // Presente só nos gatilhos em lote/diários (sem alvo pontual como uma
  // escala/evento específico) — quando ausente, o ícone "Enviar agora" não
  // aparece no card.
  confirmacaoEnvioManual?: string;
};

const inputCls =
  "w-full rounded-xl border border-edge px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";
const labelCls = "mb-1 block text-sm font-medium text-ink-soft";

export function IconeEnviar() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m3 3 18 9-18 9 4.5-9L3 3Z" />
      <path d="M7.5 12H21" />
    </svg>
  );
}

function IconeInfo() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="0.1" fill="currentColor" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

// Ícone "i" com tooltip PRÓPRIO (não o title nativo do navegador) — mostra a
// descrição da regra, que antes ficava como texto fixo no card (tirado pra
// deixar mais enxuto, principalmente em telas pequenas). O painel é ancorado
// no container pai (que precisa ser o `relative` que ocupa a largura do
// card) via `inset-x-0`, então ele nunca ultrapassa a largura do card — e o
// texto quebra normalmente (`whitespace-pre-wrap`) dentro desse limite, ao
// contrário do tooltip nativo (que não respeita largura nem quebra linha).
function IconeInfoComTooltip({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLSpanElement>(null);
  const painelId = useId();

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <span ref={raiz} className="inline-flex">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={painelId}
        aria-label={texto}
        onMouseEnter={() => setAberto(true)}
        onMouseLeave={() => setAberto(false)}
        onClick={() => setAberto((v) => !v)}
        className="cursor-help text-ink-subtle transition hover:text-brand"
      >
        <IconeInfo />
      </button>
      {aberto && (
        <div
          id={painelId}
          role="tooltip"
          className="vidro-forte absolute inset-x-0 top-full z-20 mt-2 whitespace-pre-wrap break-words rounded-xl p-3 text-xs leading-relaxed text-ink-soft shadow-lg"
        >
          {texto}
        </div>
      )}
    </span>
  );
}

function IconeCarregando() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

// Ícone "Enviar agora" ao lado de "Ativa": dispara a notificação de verdade
// para os destinatários reais elegíveis no momento (não é simulação), depois
// de confirmar no cliente para quem vai. Só existe nos gatilhos em lote —
// nova_escala/escala_alterada/edição disparam a partir da ação real que os
// origina, não fazem sentido "enviar agora" sem um alvo específico.
function BotaoEnviarAgora({
  gatilho,
  confirmacao,
}: {
  gatilho: GatilhoNotificacao;
  confirmacao: string;
}) {
  const [estado, formAction, pendente] = useActionState(enviarNotificacaoManual, null);

  return (
    <>
      <button
        type="button"
        title="Enviar esta notificação agora"
        aria-label="Enviar esta notificação agora"
        disabled={pendente}
        onClick={() => {
          if (!window.confirm(confirmacao)) return;
          const fd = new FormData();
          fd.set("gatilho", gatilho);
          formAction(fd);
        }}
        className="flex shrink-0 items-center justify-center rounded-lg border border-edge-soft p-1.5 text-ink-subtle transition hover:border-brand hover:text-brand disabled:opacity-60"
      >
        {pendente ? <IconeCarregando /> : <IconeEnviar />}
      </button>
      <FeedbackModal estado={estado} />
    </>
  );
}

const AVISO_PADRAO = "Notifica todos os membros escalados, sem filtro de nível de acesso.";

export function RegraNotificacaoForm({ regra }: { regra: RegraDados }) {
  const [estado, formAction, pendente] = useActionState(salvarConfigNotificacao, null);
  // Junta a descrição do gatilho com o aviso de destinatários (quando não há
  // seletor de níveis-alvo) num só tooltip — evita repetir texto explicativo
  // solto no card, mesma ideia usada na descrição.
  const tooltipTitulo = regra.usaNiveisAlvo
    ? regra.descricao
    : `${regra.descricao} ${regra.avisoDestinatarios ?? AVISO_PADRAO}`;

  return (
    <>
      <form
        action={formAction}
        className="space-y-4 rounded-2xl border border-edge-soft vidro-leve p-5"
      >
        <input type="hidden" name="id" value={regra.id} />

        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-ink">{regra.titulo}</h3>
            <IconeInfoComTooltip texto={tooltipTitulo} />
            {!regra.implementado && (
              <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn-text">
                Em breve
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {regra.confirmacaoEnvioManual && (
              <BotaoEnviarAgora gatilho={regra.gatilho} confirmacao={regra.confirmacaoEnvioManual} />
            )}
            <label className="flex items-center gap-2 text-sm font-medium text-ink-soft">
              <input
                type="checkbox"
                name="ativo"
                defaultChecked={regra.ativo}
                className="accent-brand"
              />
              Ativa
            </label>
          </div>
        </div>

        {regra.usaNiveisAlvo ? (
          <div>
            <p className={labelCls}>Enviar para (nível de acesso)</p>
            <div className="flex flex-wrap gap-2">
              {NIVEIS.map((n) => (
                <label
                  key={n}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-edge-soft px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-faint"
                >
                  <input
                    type="checkbox"
                    name="niveisAlvo"
                    value={n}
                    defaultChecked={regra.niveisAlvo.includes(n)}
                    className="accent-brand"
                  />
                  {ROTULO_NIVEL[n]}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-subtle">
              Nenhum marcado = envia para todos os níveis.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              name="canalEmail"
              defaultChecked={regra.canais.includes("email")}
              className="accent-brand"
            />
            E-mail
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              name="canalTelegram"
              defaultChecked={regra.canais.includes("telegram")}
              className="accent-brand"
            />
            Telegram
          </label>
        </div>

        {regra.usaHorario && (
          <div className="max-w-xs">
            <label htmlFor={`horario-${regra.id}`} className={labelCls}>
              Horário de envio
            </label>
            <input
              id={`horario-${regra.id}`}
              name="horarioEnvio"
              type="time"
              defaultValue={regra.horarioEnvio ?? ""}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-ink-subtle">
              {regra.implementado
                ? "O sistema confere a cada poucos minutos e dispara assim que bater esse horário (não repete no mesmo dia)."
                : "Só vale quando o envio deste gatilho for implementado."}
            </p>
          </div>
        )}

        <div>
          <label htmlFor={`assunto-${regra.id}`} className={labelCls}>
            Assunto do e-mail
          </label>
          <input
            id={`assunto-${regra.id}`}
            name="assunto"
            defaultValue={regra.assunto ?? ""}
            maxLength={200}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor={`mensagem-${regra.id}`} className={labelCls}>
            Mensagem
          </label>
          <textarea
            id={`mensagem-${regra.id}`}
            name="mensagem"
            rows={4}
            defaultValue={regra.mensagem ?? ""}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-ink-subtle">
            Use <code>{"{{nome}}"}</code> para o primeiro nome do destinatário.
          </p>
        </div>

        <button
          type="submit"
          disabled={pendente}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pendente ? "Salvando…" : "Salvar regra"}
        </button>
      </form>
      <FeedbackModal estado={estado} />
    </>
  );
}
