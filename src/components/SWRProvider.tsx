"use client";

import { SWRConfig, type Cache } from "swr";

// Cache do SWR persistido no localStorage — sobrevive a um F5/nova aba (o
// cache em memória padrão do SWR só sobrevive a navegações client-side).
// Namespeado por usuário (cacheKey) para nunca mostrar, nem por um
// instante, o dashboard cacheado de outra conta no mesmo aparelho — a API
// sempre reverifica a sessão e reaplica o escopo, então isto é só o
// instante visual antes da revalidação, não uma checagem de segurança.
function localStorageProvider(chaveArmazenamento: string): () => Cache {
  return () => {
    let mapa: Map<string, unknown>;
    try {
      const salvo = localStorage.getItem(chaveArmazenamento);
      mapa = new Map(salvo ? JSON.parse(salvo) : []);
    } catch {
      mapa = new Map();
    }

    // O provider do SWR pode ser avaliado durante o SSR (sem `window`) —
    // só registra o listener no navegador.
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        try {
          localStorage.setItem(
            chaveArmazenamento,
            JSON.stringify([...mapa.entries()]),
          );
        } catch {
          // Modo privado / quota estourada — segue sem persistir.
        }
      });
    }

    return mapa as unknown as Cache;
  };
}

export function SWRProvider({
  cacheKey,
  children,
}: {
  cacheKey: string;
  children: React.ReactNode;
}) {
  return (
    <SWRConfig
      value={{ provider: localStorageProvider(`agape-swr-${cacheKey}`) }}
    >
      {children}
    </SWRConfig>
  );
}
