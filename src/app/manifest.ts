import type { MetadataRoute } from "next";

// Manifesto PWA — é o que permite "adicionar à tela inicial" no celular com
// ícone próprio e abertura em tela cheia (sem a barra do navegador).
// Ícones gerados por `npm run icones` (scripts/gerar-icones.ts).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ministério Ágape",
    short_name: "Ágape",
    description:
      "Recebendo a Todos com Muito Amor. Sistema de gestão do Ministério Ágape — Igreja Batista Casa de Deus, Jundiaí/SP.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    // Navy da marca: pinta a barra de status quando aberto pelo atalho.
    theme_color: "#0D2B5C",
    background_color: "#0D2B5C",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // "maskable" tem respiro extra: o Android recorta o ícone em círculo.
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
