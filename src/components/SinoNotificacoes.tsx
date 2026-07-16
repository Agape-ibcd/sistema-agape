"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Notificacoes } from "@/lib/notificacoes";

const SEM_NOTIFICACOES: Notificacoes = { aniversariantesHoje: [], escalas: [] };
const INTERVALO_ATUALIZACAO_MS = 5 * 60 * 1000;

// Sino de notificações do cabeçalho: aniversariantes do dia + lembrete de
// escala. Busca os dados pelo navegador (rota /api/notificacoes) em vez de
// no layout do servidor — assim a consulta ao banco não entra no caminho
// crítico de toda navegação (aniversariantes/escalas não mudam a cada
// clique de menu). Atualiza a cada 5 minutos.
//
// Balança e brilha em neon (classe `sino-alerta`, ver globals.css — azul no
// tema claro, amarelo no escuro) enquanto houver ALGUM lembrete ainda não
// lido. Cada notificação clicada é marcada como lida individualmente
// (localStorage por dia) — o contador cai um a um e o sino só para de
// balançar quando todas forem lidas.
export function SinoNotificacoes({
  flutuante = false,
}: {
  flutuante?: boolean;
}) {
  const [dados, setDados] = useState<Notificacoes>(SEM_NOTIFICACOES);
  const [aberto, setAberto] = useState(false);
  const [lidos, setLidos] = useState<Set<string>>(new Set());
  const raiz = useRef<HTMLDivElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const chaveLidos = `sino-lidos-${new Date().toLocaleDateString("en-CA")}`;

  useEffect(() => {
    const salvo = localStorage.getItem(chaveLidos);
    if (salvo) setLidos(new Set(JSON.parse(salvo) as string[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelado = false;
    async function buscar() {
      try {
        const res = await fetch("/api/notificacoes");
        if (!res.ok) return;
        const json = (await res.json()) as Notificacoes;
        if (!cancelado) setDados(json);
      } catch {
        // Silencioso — o sino só deixa de mostrar novidades até a próxima
        // tentativa; não interfere na navegação.
      }
    }
    buscar();
    const intervalo = setInterval(buscar, INTERVALO_ATUALIZACAO_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, []);

  const aniversariantesPendentes = dados.aniversariantesHoje.filter(
    (a) => !lidos.has(`aniv-${a.id}`),
  );
  const escalasPendentes = dados.escalas.filter(
    (e) => !lidos.has(`escala-${e.eventoId}-${e.equipeNome}`),
  );
  const total = aniversariantesPendentes.length + escalasPendentes.length;
  const temAlerta = total > 0;

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

  // Mantém o painel dentro da viewport (idêntico ao Popover): parte
  // alinhado à direita do sino, mas desloca se estourar a borda esquerda ou
  // direita da tela — crítico na barra lateral do desktop, perto da borda
  // esquerda.
  useLayoutEffect(() => {
    if (!aberto || !raiz.current || !painel.current) return;
    const wrapper = raiz.current.getBoundingClientRect();
    const p = painel.current.getBoundingClientRect();
    const margem = 8;
    const larguraTela = document.documentElement.clientWidth;
    const desejado = wrapper.right - p.width;
    const min = margem;
    const max = larguraTela - p.width - margem;
    const alvo = Math.min(Math.max(desejado, min), max);
    painel.current.style.left = `${alvo - wrapper.left}px`;
  }, [aberto]);

  function marcarComoLido(chave: string) {
    setLidos((atual) => {
      const novo = new Set(atual);
      novo.add(chave);
      localStorage.setItem(chaveLidos, JSON.stringify([...novo]));
      return novo;
    });
    setAberto(false);
  }

  // No modo flutuante (menu lateral oculto) o sino só existe enquanto há
  // lembrete pendente — some sozinho assim que tudo for lido.
  if (flutuante && !temAlerta) return null;

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-label={
          temAlerta ? `Notificações (${total} pendente(s))` : "Notificações"
        }
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className={`relative rounded-lg p-2 text-ink-soft hover:bg-surface-3 ${
          flutuante ? "border border-edge-soft bg-surface shadow-lg" : ""
        }`}
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
          className={temAlerta ? "sino-alerta" : ""}
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
          ref={painel}
          role="menu"
          style={{ left: 0 }}
          className="absolute z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-edge-soft bg-surface p-3 shadow-lg"
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
              {aniversariantesPendentes.map((a) => (
                <li key={`aniv-${a.id}`}>
                  <Link
                    href="/aniversariantes"
                    onClick={() => marcarComoLido(`aniv-${a.id}`)}
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
              {escalasPendentes.map((e) => (
                <li key={`escala-${e.eventoId}-${e.equipeNome}`}>
                  <Link
                    href="/eventos"
                    onClick={() =>
                      marcarComoLido(`escala-${e.eventoId}-${e.equipeNome}`)
                    }
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
