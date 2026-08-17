"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { MembroResumo } from "@/lib/membroResumo";

// ─────────────────────────────────────────────────────────────────────────
// Hover card de pessoa: envolve uma foto/nome (o `children`) e, ao passar o
// mouse por 1s ou clicar, mostra um painel flutuante com foto, ícones de
// aniversário/status/assiduidade/pontualidade, equipe e próxima escala.
//
// Coordenação entre instâncias (módulo inteiro, não por componente): só um
// card fica aberto por vez. Um clique "para fora" de um card aberto SÓ o
// fecha, mesmo que o clique tenha caído em outro gatilho — abrir outro exige
// um segundo clique (comportamento pedido explicitamente: evita abrir um
// card "sem querer" ao tentar apenas fechar o anterior).
//
// Fecha: ao tirar o mouse do card/gatilho e ficar fora por 3s (só em
// dispositivos com hover de verdade — no touch, o toque abre e só some ao
// tocar fora), ao clicar fora, ou Esc. O clique no gatilho sempre intercepta
// (preventDefault + stopPropagation): necessário quando a foto/nome já está
// dentro de um <Link> ou <label> de checkbox — sem isso o clique navegaria/
// marcaria a caixa em vez de abrir o card.
// ─────────────────────────────────────────────────────────────────────────

const ATRASO_HOVER_MS = 1000;
const ATRASO_FECHAR_MS = 3000;
const cacheResumo = new Map<string, MembroResumo>();

function suportaHover(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(hover: hover)").matches;
}

// Estado global simples (fora do React): garante um único card aberto por
// vez e sinaliza quando um clique acabou de fechar um card "para fora", para
// o gatilho clicado não abrir o seu na mesma tacada.
let idAberto: string | null = null;
let fechouParaForaNesteClique = false;
const ouvintes = new Set<(id: string | null) => void>();

function definirAberto(id: string | null) {
  idAberto = id;
  ouvintes.forEach((fn) => fn(id));
}

export function PessoaHoverCard({
  membroId,
  children,
  className = "",
}: {
  membroId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [resumo, setResumo] = useState<MembroResumo | null>(cacheResumo.get(membroId) ?? null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);

  const raizRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const timerAbrirRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerFecharRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function limparTimerAbrir() {
    if (timerAbrirRef.current) {
      clearTimeout(timerAbrirRef.current);
      timerAbrirRef.current = null;
    }
  }

  function limparTimerFechar() {
    if (timerFecharRef.current) {
      clearTimeout(timerFecharRef.current);
      timerFecharRef.current = null;
    }
  }

  async function carregarResumo() {
    const emCache = cacheResumo.get(membroId);
    if (emCache) {
      setResumo(emCache);
      return;
    }
    setCarregando(true);
    setErro(false);
    try {
      const res = await fetch(`/api/membros/${membroId}/resumo`);
      if (!res.ok) throw new Error("falha ao buscar resumo");
      const dados = (await res.json()) as MembroResumo;
      cacheResumo.set(membroId, dados);
      setResumo(dados);
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }

  function abrir() {
    setAberto(true);
    definirAberto(membroId);
    void carregarResumo();
  }

  function fechar() {
    limparTimerAbrir();
    limparTimerFechar();
    setAberto(false);
    if (idAberto === membroId) definirAberto(null);
  }

  // Outra instância abriu: se a minha estava aberta, fecha (só um por vez).
  useEffect(() => {
    function aoMudarAberto(id: string | null) {
      if (id !== membroId) setAberto(false);
    }
    ouvintes.add(aoMudarAberto);
    return () => {
      ouvintes.delete(aoMudarAberto);
    };
  }, [membroId]);

  function aoEntrarMouse() {
    if (!suportaHover()) return;
    limparTimerFechar();
    limparTimerAbrir();
    timerAbrirRef.current = setTimeout(abrir, ATRASO_HOVER_MS);
  }

  function aoSairMouse() {
    if (!suportaHover()) return;
    limparTimerAbrir();
    limparTimerFechar();
    timerFecharRef.current = setTimeout(fechar, ATRASO_FECHAR_MS);
  }

  function aoClicar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Havia outro card aberto e este clique (fora dele) acabou de fechá-lo:
    // esse clique só serviu para fechar — não abre o meu junto.
    if (fechouParaForaNesteClique) {
      fechouParaForaNesteClique = false;
      return;
    }
    limparTimerAbrir();
    limparTimerFechar();
    abrir();
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      abrir();
    }
  }

  function aoClicarEditar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    fechar();
    router.push(`/membros/${membroId}`);
  }

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent | TouchEvent) {
      // O tooltip dos ícones (Aniversário/Status/Assiduidade/Pontualidade) é
      // renderizado num portal em document.body (pra nunca ser cortado pela
      // rolagem do card) — logo não é descendente de raizRef. Clicar nele
      // não pode fechar o card.
      if ((e.target as Element).closest?.("[data-info-tooltip]")) return;
      if (raizRef.current && !raizRef.current.contains(e.target as Node)) {
        fechouParaForaNesteClique = true;
        // Se o clique não caiu em nenhum gatilho (não há PessoaHoverCard ali
        // pra consumir a flag), desarma sozinha antes do próximo clique —
        // senão um clique futuro e não relacionado ficaria bloqueado.
        setTimeout(() => {
          fechouParaForaNesteClique = false;
        }, 0);
        fechar();
      }
    }
    function aoTeclarEsc(e: KeyboardEvent) {
      if (e.key === "Escape") fechar();
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("touchstart", aoClicarFora);
    document.addEventListener("keydown", aoTeclarEsc);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("touchstart", aoClicarFora);
      document.removeEventListener("keydown", aoTeclarEsc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fechar` é estável o bastante aqui (mesmas refs/estado a cada render)
  }, [aberto]);

  useEffect(
    () => () => {
      limparTimerAbrir();
      limparTimerFechar();
    },
    [],
  );

  // Mantém o painel dentro da viewport (largura e altura), igual ao Popover:
  // parte alinhado à esquerda do gatilho, abaixo dele, mas se reposiciona (ou
  // vira para cima) quando estouraria a borda da tela.
  useLayoutEffect(() => {
    if (!aberto || !raizRef.current || !painelRef.current) return;
    const gatilho = raizRef.current.getBoundingClientRect();
    const p = painelRef.current.getBoundingClientRect();
    const margem = 12;
    const larguraTela = document.documentElement.clientWidth;
    const alturaTela = document.documentElement.clientHeight;

    const minX = margem;
    const maxX = larguraTela - p.width - margem;
    const alvoX = Math.min(Math.max(gatilho.left, minX), maxX);
    painelRef.current.style.left = `${alvoX - gatilho.left}px`;

    const espacoAbaixo = alturaTela - gatilho.bottom;
    const viraParaCima = espacoAbaixo < p.height + margem && gatilho.top > p.height + margem;
    painelRef.current.style.top = viraParaCima ? "auto" : `${gatilho.height + 6}px`;
    painelRef.current.style.bottom = viraParaCima ? `${gatilho.height + 6}px` : "auto";
  }, [aberto, resumo, carregando, erro]);

  return (
    <div
      ref={raizRef}
      role="button"
      tabIndex={0}
      onMouseEnter={aoEntrarMouse}
      onMouseLeave={aoSairMouse}
      onClick={aoClicar}
      onKeyDown={aoTeclar}
      // `className` decide o display (flex quando envolve foto+nome lado a
      // lado, ou nada = inline-block quando é só um nome solto) — nunca os
      // dois ao mesmo tempo, senão a cascata do Tailwind desempata errado.
      className={`relative cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring ${className || "inline-block"}`}
    >
      {children}

      {aberto && (
        <div
          ref={painelRef}
          role="dialog"
          aria-label={`Detalhes de ${resumo?.nomeCompleto ?? "membro"}`}
          style={{ left: 0 }}
          // Clique em QUALQUER lugar do painel (texto, ícones, o painel em
          // si) não deve abrir a edição — só o lápis navega, e ele já
          // intercepta o próprio clique antes de chegar aqui. Sem isso, o
          // clique vaza pro <Link> da linha (foto/nome) em telas como a
          // lista de Membros.
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={`vidro-forte absolute z-30 max-h-[85vh] w-[min(19rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl p-3.5 shadow-xl ${resumo?.podeEditar ? "pr-9" : ""}`}
        >
          {resumo?.podeEditar && (
            <button
              type="button"
              onClick={aoClicarEditar}
              title="Editar Dados"
              aria-label="Editar dados"
              className="absolute right-2 top-2 rounded-lg p-1.5 text-ink-subtle transition hover:bg-surface-3 hover:text-brand-text"
            >
              <IconeLapis />
            </button>
          )}
          <ConteudoResumo resumo={resumo} carregando={carregando} erro={erro} />
        </div>
      )}
    </div>
  );
}

function IconeLapis() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function IconeBolo() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 21v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6" />
      <path d="M2 21h20" />
      <path d="M7 13c0-1.4 1-1.4 1-2.8S7 7.4 7 6" />
      <path d="M12 13c0-1.4 1-1.4 1-2.8S12 7.4 12 6" />
      <path d="M17 13c0-1.4 1-1.4 1-2.8S17 7.4 17 6" />
    </svg>
  );
}

function IconeStatus() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function IconeAssiduidade() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconePontualidade() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function ConteudoResumo({
  resumo,
  carregando,
  erro,
}: {
  resumo: MembroResumo | null;
  carregando: boolean;
  erro: boolean;
}) {
  // Tooltip dos 4 ícones (aniversário/status/assiduidade/pontualidade): além
  // do `title` nativo (só funciona com mouse), também abre ao tocar/clicar —
  // em telas pequenas não há hover, então o title nunca aparece. Guarda a
  // posição do ícone (não só o texto) porque o balão é desenhado num portal
  // em document.body, fixo por coordenadas de viewport — assim ele pode
  // sobrepor a borda do card em vez de ser cortado pela rolagem (overflow-y
  // do card também recorta o eixo X; um balão preso dentro dele estouraria
  // cortado).
  const [tooltip, setTooltip] = useState<{ titulo: string; rect: DOMRect } | null>(null);
  function alternarTooltip(titulo: string, alvo: HTMLElement) {
    setTooltip((v) => (v && v.titulo === titulo ? null : { titulo, rect: alvo.getBoundingClientRect() }));
  }

  useEffect(() => {
    if (!tooltip) return;
    function aoTocarFora(e: MouseEvent | TouchEvent) {
      const alvo = e.target as Element;
      if (!alvo.closest?.("[data-info-trigger]") && !alvo.closest?.("[data-info-tooltip]")) {
        setTooltip(null);
      }
    }
    document.addEventListener("mousedown", aoTocarFora);
    document.addEventListener("touchstart", aoTocarFora);
    return () => {
      document.removeEventListener("mousedown", aoTocarFora);
      document.removeEventListener("touchstart", aoTocarFora);
    };
  }, [tooltip]);

  if (erro) {
    return <p className="text-xs text-danger-text">Não foi possível carregar os dados.</p>;
  }
  if (!resumo) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="h-[clamp(56px,18vw,88px)] w-[clamp(56px,18vw,88px)] shrink-0 animate-pulse rounded-2xl bg-surface-3" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-surface-3" />
          <div className="h-2.5 w-1/2 animate-pulse rounded bg-surface-3" />
        </div>
      </div>
    );
  }

  const iniciais = resumo.nomeCompleto
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .filter((_, i, arr) => i === 0 || i === arr.length - 1)
    .join("")
    .toUpperCase();

  const rotuloStatus =
    resumo.status === "ativo" ? "Ativo" : resumo.status === "afastado" ? "Afastado" : "Inativo";
  const corStatus =
    resumo.status === "ativo"
      ? "text-success-text"
      : resumo.status === "afastado"
        ? "text-warn-text"
        : "text-ink-soft";

  return (
    <div className={carregando ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <div className="flex items-start gap-2.5">
        {resumo.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto externa (Supabase Storage)
          <img
            src={resumo.fotoUrl}
            alt={`Foto de ${resumo.nomeCompleto}`}
            className="h-[clamp(56px,18vw,88px)] w-[clamp(56px,18vw,88px)] shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-[clamp(56px,18vw,88px)] w-[clamp(56px,18vw,88px)] shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-lg font-semibold text-brand-text"
          >
            {iniciais || "?"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[13px] font-semibold uppercase tracking-wide text-ink">
            {resumo.nomeCompleto}
          </p>

          <div className="mt-1 flex items-stretch gap-2.5 text-[11px] text-ink-soft">
            <div className="flex flex-col justify-center gap-y-1">
              <InfoIcone titulo="Aniversário" aoClicar={alternarTooltip}>
                <IconeBolo />
                {resumo.dataNascimentoBR ?? "—"}
              </InfoIcone>
              <InfoIcone titulo="Status" aoClicar={alternarTooltip} className={corStatus}>
                <IconeStatus />
                {rotuloStatus}
              </InfoIcone>
            </div>
            <div aria-hidden className="w-px shrink-0 bg-edge-soft" />
            <div className="flex flex-col justify-center gap-y-1">
              <InfoIcone
                titulo="Assiduidade — % de presença nos últimos 90 dias"
                aoClicar={alternarTooltip}
              >
                <IconeAssiduidade />
                {resumo.assiduidade90 == null ? "—" : `${resumo.assiduidade90}%`}
              </InfoIcone>
              <InfoIcone
                titulo="Pontualidade — % de chegada no horário (1h15 antes do culto) nos últimos 90 dias"
                aoClicar={alternarTooltip}
              >
                <IconePontualidade />
                {resumo.pontualidade90 == null ? "—" : `${resumo.pontualidade90}%`}
              </InfoIcone>
            </div>
          </div>

          {tooltip && <TooltipFlutuante titulo={tooltip.titulo} rect={tooltip.rect} />}

          {resumo.status !== "ativo" && resumo.motivoStatus && (
            <p className="mt-1 text-[10px] text-ink-subtle">Motivo: {resumo.motivoStatus}</p>
          )}
        </div>
      </div>

      <dl className="mt-2.5 space-y-1 text-[11px]">
        <LinhaInfo
          rotulo="Equipe"
          valor={
            <span className="inline-flex items-center gap-1.5">
              {resumo.equipe?.corHex && (
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: resumo.equipe.corHex }}
                />
              )}
              {resumo.equipe?.nome ?? "Sem equipe"}
            </span>
          }
        />
        {resumo.lideraEquipes.length > 0 && (
          <LinhaInfo
            rotulo="Lidera"
            valor={resumo.lideraEquipes.map((e) => e.nome).join(", ")}
          />
        )}
        <LinhaInfo
          rotulo="Próxima escala"
          valor={
            resumo.proximaEscala
              ? `${resumo.proximaEscala.dataEventoBR} — ${resumo.proximaEscala.tipoEventoNome}`
              : "Nenhuma escala futura"
          }
          quebrar
        />
      </dl>
    </div>
  );
}

// Ícone + valor com tooltip: `title` nativo pro mouse, e clicar/tocar avisa
// o pai (ConteudoResumo) pra abrir/fechar o balão flutuante com `titulo`
// (necessário em telas sem hover, onde o `title` nunca aparece).
// `data-info-trigger` marca o elemento pro listener de "tocar fora" (no pai)
// reconhecer um clique dentro de QUALQUER gatilho.
function InfoIcone({
  titulo,
  aoClicar,
  className = "",
  children,
}: {
  titulo: string;
  aoClicar: (titulo: string, alvo: HTMLElement) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      data-info-trigger
      title={titulo}
      onClick={(e) => {
        // preventDefault é essencial aqui: a linha (foto/nome) costuma estar
        // dentro de um <Link> da tela (ex.: lista de Membros) — só
        // stopPropagation não cancela a navegação do link ancestral.
        e.preventDefault();
        e.stopPropagation();
        aoClicar(titulo, e.currentTarget);
      }}
      className={`inline-flex cursor-pointer items-center gap-1 ${className}`}
    >
      {children}
    </span>
  );
}

// Balão do tooltip tocável, num portal em document.body posicionado por
// coordenadas de viewport (position: fixed) — assim ele pode se sobrepor
// livremente à borda do card em vez de ser cortado pela rolagem dele.
// Renderiza uma vez "invisível" pra medir o próprio tamanho e só então fixa
// a posição definitiva (evita flash na posição errada).
function TooltipFlutuante({ titulo, rect }: { titulo: string; rect: DOMRect }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const margem = 8;
    const larguraTela = document.documentElement.clientWidth;
    const alturaTela = document.documentElement.clientHeight;
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;

    const left = Math.min(Math.max(rect.left, margem), larguraTela - w - margem);
    let top = rect.bottom + 6;
    if (top + h > alturaTela - margem) {
      top = rect.top - h - 6; // não cabe embaixo: vira pra cima do ícone
    }
    setPos({ left, top });
  }, [rect]);

  return createPortal(
    <div
      ref={ref}
      data-info-tooltip
      role="tooltip"
      style={{
        position: "fixed",
        left: pos?.left ?? rect.left,
        top: pos?.top ?? rect.bottom + 6,
        visibility: pos ? "visible" : "hidden",
      }}
      className="z-[60] w-max max-w-[13rem] rounded-md border border-edge bg-surface-3 px-2 py-1 text-[10px] font-normal normal-case leading-snug tracking-normal text-ink shadow-xl"
    >
      {titulo}
    </div>,
    document.body,
  );
}

function LinhaInfo({
  rotulo,
  valor,
  quebrar = false,
}: {
  rotulo: React.ReactNode;
  valor: React.ReactNode;
  quebrar?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2.5">
      <dt className="shrink-0 text-ink-subtle">{rotulo}</dt>
      <dd className={`min-w-0 text-right font-medium text-ink ${quebrar ? "" : "truncate"}`}>
        {valor}
      </dd>
    </div>
  );
}
