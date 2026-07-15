"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Notificacoes } from "@/lib/notificacoes";

// Sino de notificações do cabeçalho: aniversariantes do dia + lembrete de
// escala. Balança e brilha em neon (classe `sino-alerta`, ver globals.css —
// azul no tema claro, amarelo no escuro) enquanto houver lembrete pendente
// E o usuário ainda não tiver clicado em nenhuma notificação. O "lido" fica
// em localStorage por dia (as notificações são diárias) para não voltar a
// piscar ao navegar entre páginas.
export function SinoNotificacoes({
  aniversariantesHoje,
  escalas,
}: Notificacoes) {
  const [aberto, setAberto] = useState(false);
  const [lido, setLido] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  const total = aniversariantesHoje.length + escalas.length;
  const temAlerta = total > 0;
  const chaveLido = `sino-lido-${new Date().toLocaleDateString("en-CA")}`;

  useEffect(() => {
    if (localStorage.getItem(chaveLido)) setLido(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) {
        setAberto(false);
      }
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

  function marcarComoLido() {
    localStorage.setItem(chaveLido, "1");
    setLido(true);
    setAberto(false);
  }

  const piscando = temAlerta && !lido;

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-label={
          temAlerta ? `Notificações (${total} pendente(s))` : "Notificações"
        }
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="relative rounded-lg p-2 text-ink-soft hover:bg-surface-3"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={piscando ? "sino-alerta" : ""}
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {temAlerta && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {total}
          </span>
        )}
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-edge-soft bg-surface p-3 shadow-lg"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Notificações
          </p>

          {total === 0 ? (
            <p className="py-2 text-sm text-ink-subtle">
              Sem lembretes por aqui.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {aniversariantesHoje.map((a) => (
                <li key={`aniv-${a.id}`}>
                  <Link
                    href="/aniversariantes"
                    onClick={marcarComoLido}
                    className="flex items-start gap-2 rounded-xl p-2 text-sm hover:bg-surface-3"
                  >
                    <span aria-hidden>🎂</span>
                    <span>
                      <span className="font-medium text-ink">
                        {a.nome}
                      </span>{" "}
                      <span className="text-ink-subtle">
                        faz aniversário hoje
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {escalas.map((e) => (
                <li key={`escala-${e.eventoId}-${e.equipeNome}`}>
                  <Link
                    href="/eventos"
                    onClick={marcarComoLido}
                    className="flex items-start gap-2 rounded-xl p-2 text-sm hover:bg-surface-3"
                  >
                    <span aria-hidden>📋</span>
                    <span>
                      <span className="font-medium text-ink">
                        {e.equipeNome}
                      </span>{" "}
                      <span className="text-ink-subtle">
                        escalada em {e.tipoEventoNome} —{" "}
                        {e.diasAte === 0
                          ? "hoje"
                          : e.diasAte === 1
                            ? "amanhã"
                            : `em ${e.diasAte} dias`}{" "}
                        ({e.dataBR})
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
