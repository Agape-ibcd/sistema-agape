"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MembroResumo } from "@/lib/membroResumo";

// ─────────────────────────────────────────────────────────────────────────
// Hover card de pessoa: envolve uma foto/nome (o `children`) e, ao passar o
// mouse por 1s ou clicar, mostra um painel flutuante com foto grande, nome,
// aniversário, equipe e próxima escala. Some ao tirar o mouse do card/gatilho
// ou ao clicar fora. Busca o resumo via /api/membros/[id]/resumo (com cache
// simples em memória entre instâncias, já que a mesma pessoa pode aparecer
// várias vezes na mesma tela).
//
// O clique no gatilho sempre intercepta (preventDefault + stopPropagation):
// necessário quando a foto/nome já está dentro de um <Link> ou <label> de
// checkbox (ex.: lista de membros, lista de usuários) — sem isso o clique
// navegaria/marcaria a caixa em vez de abrir o card.
// ─────────────────────────────────────────────────────────────────────────

const ATRASO_HOVER_MS = 1000;
const cacheResumo = new Map<string, MembroResumo>();

export function PessoaHoverCard({
  membroId,
  children,
  className = "",
}: {
  membroId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [resumo, setResumo] = useState<MembroResumo | null>(cacheResumo.get(membroId) ?? null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);

  const raizRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function limparTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
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
    void carregarResumo();
  }

  function aoEntrarMouse() {
    limparTimer();
    timerRef.current = setTimeout(abrir, ATRASO_HOVER_MS);
  }

  function aoSairMouse() {
    limparTimer();
    setAberto(false);
  }

  function aoClicar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    limparTimer();
    abrir();
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      abrir();
    }
  }

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (raizRef.current && !raizRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    function aoTeclarEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclarEsc);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclarEsc);
    };
  }, [aberto]);

  useEffect(() => limparTimer, []);

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
    painelRef.current.style.top = viraParaCima ? "auto" : `${gatilho.height + 8}px`;
    painelRef.current.style.bottom = viraParaCima ? `${gatilho.height + 8}px` : "auto";
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
      className={`relative inline-block cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring ${className}`}
    >
      {children}

      {aberto && (
        <div
          ref={painelRef}
          role="dialog"
          aria-label={`Detalhes de ${resumo?.nomeCompleto ?? "membro"}`}
          style={{ left: 0 }}
          className="vidro-forte absolute z-30 w-[min(20rem,calc(100vw-2rem))] rounded-2xl p-4 shadow-xl"
        >
          <ConteudoResumo resumo={resumo} carregando={carregando} erro={erro} />
        </div>
      )}
    </div>
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
  if (erro) {
    return <p className="text-sm text-danger-text">Não foi possível carregar os dados.</p>;
  }
  if (!resumo) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-[clamp(72px,22vw,112px)] w-[clamp(72px,22vw,112px)] shrink-0 animate-pulse rounded-2xl bg-surface-3" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-3/4 animate-pulse rounded bg-surface-3" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-surface-3" />
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

  return (
    <div className={carregando ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <div className="flex items-center gap-3">
        {resumo.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto externa (Supabase Storage)
          <img
            src={resumo.fotoUrl}
            alt={`Foto de ${resumo.nomeCompleto}`}
            className="h-[clamp(72px,22vw,112px)] w-[clamp(72px,22vw,112px)] shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-[clamp(72px,22vw,112px)] w-[clamp(72px,22vw,112px)] shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-2xl font-semibold text-brand-text"
          >
            {iniciais || "?"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold uppercase tracking-wide text-ink">
            {resumo.nomeCompleto}
          </p>
          {resumo.status !== "ativo" && (
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                resumo.status === "afastado"
                  ? "bg-warn-soft text-warn-text"
                  : "bg-surface-3 text-ink-soft"
              }`}
            >
              {resumo.status === "afastado" ? "Afastado" : "Inativo"}
            </span>
          )}
        </div>
      </div>

      <dl className="mt-3 space-y-1.5 text-sm">
        <LinhaInfo rotulo="Aniversário" valor={resumo.dataNascimentoBR ?? "Não informado"} />
        <LinhaInfo
          rotulo="Equipe"
          valor={
            <span className="inline-flex items-center gap-1.5">
              {resumo.equipe?.corHex && (
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
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
        />
      </dl>
    </div>
  );
}

function LinhaInfo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-ink-subtle">{rotulo}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-ink">{valor}</dd>
    </div>
  );
}
