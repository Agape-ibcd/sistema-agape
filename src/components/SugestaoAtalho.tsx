"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// ─────────────────────────────────────────────────────────────────────────
// Convite para adicionar o sistema à tela inicial do celular.
//
//  • Android/Chrome: o navegador dispara `beforeinstallprompt`; guardamos o
//    evento e o disparamos no clique do botão (só é válido dentro do gesto).
//  • iOS/Safari: NÃO existe esse evento — o único caminho é o usuário usar
//    Compartilhar → "Adicionar à Tela de Início", então mostramos a instrução.
//
// Não aparece se o app já estiver aberto pelo atalho (standalone), no desktop,
// ou se a pessoa já dispensou (preferência guardada no navegador).
// ─────────────────────────────────────────────────────────────────────────

const CHAVE_DISPENSADO = "atalho-tela-inicial-dispensado";

type EventoInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const assinaturaVazia = () => () => {};

export function SugestaoAtalho() {
  // false no HTML do servidor, true após a hidratação — evita divergência,
  // já que tudo aqui depende de APIs do navegador.
  const montado = useSyncExternalStore(
    assinaturaVazia,
    () => true,
    () => false,
  );
  const [evento, setEvento] = useState<EventoInstalacao | null>(null);
  const [dispensado, setDispensado] = useState(false);

  useEffect(() => {
    const aoPrompt = (e: Event) => {
      e.preventDefault(); // impede o banner nativo; usamos o nosso
      setEvento(e as EventoInstalacao);
    };
    window.addEventListener("beforeinstallprompt", aoPrompt);
    return () => window.removeEventListener("beforeinstallprompt", aoPrompt);
  }, []);

  if (!montado) return null;

  const nav = navigator as Navigator & { standalone?: boolean };
  const jaInstalado =
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true;
  if (jaInstalado || dispensado) return null;

  let jaDispensou = false;
  try {
    jaDispensou = localStorage.getItem(CHAVE_DISPENSADO) === "1";
  } catch {
    /* armazenamento indisponível — mostra o convite mesmo assim */
  }
  if (jaDispensou) return null;

  const ua = navigator.userAgent;
  const ehIOS = /iphone|ipad|ipod/i.test(ua);
  const ehAndroid = /android/i.test(ua);
  if (!ehIOS && !ehAndroid) return null; // só faz sentido no celular
  if (ehAndroid && !evento) return null; // aguarda o navegador liberar a instalação

  function dispensar() {
    try {
      localStorage.setItem(CHAVE_DISPENSADO, "1");
    } catch {
      /* segue só nesta sessão */
    }
    setDispensado(true);
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    dispensar();
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 md:hidden">
      <div className="vidro-forte flex items-start gap-3 rounded-2xl p-3 shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- ícone estático local */}
        <img
          src="/icons/icon-192.png"
          alt=""
          className="h-11 w-11 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            Deixe o Ágape na tela inicial
          </p>
          {ehIOS ? (
            <p className="mt-0.5 text-xs text-ink-soft">
              Toque em <strong>Compartilhar</strong> na barra do Safari e escolha{" "}
              <strong>“Adicionar à Tela de Início”</strong>. Fica igual a um
              aplicativo, abrindo direto.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-ink-soft">
              Abre direto como um aplicativo, sem passar pelo navegador.
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            {ehAndroid && (
              <button
                type="button"
                onClick={() => void instalar()}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong"
              >
                Adicionar
              </button>
            )}
            <button
              type="button"
              onClick={dispensar}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-subtle hover:bg-surface-3"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
