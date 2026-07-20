import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

// ─────────────────────────────────────────────────────────────────────────
// Gera os ativos de imagem da marca a partir de SVG (rodar: npm run icones).
// Saídas ficam VERSIONADAS no repo — não há geração em runtime:
//   src/app/apple-icon.png        180×180  (atalho na tela inicial do iOS)
//   public/icons/icon-192.png     192×192  (PWA / Android)
//   public/icons/icon-512.png     512×512  (PWA / splash)
//   public/icons/maskable-512.png 512×512  (ícone "maskable" do Android)
//   src/app/opengraph-image.png  1200×630  (WhatsApp, Facebook, LinkedIn…)
// O favicon é o SVG estático em src/app/icon.svg (nítido em qualquer tamanho).
// ─────────────────────────────────────────────────────────────────────────

const NAVY = "#0D2B5C";
const VERMELHO = "#E1352A";
const DOURADO = "#B8860B";
const HEART =
  "M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21Z";

// Símbolo da marca (porta + coração) em um viewBox 120×120.
function marca(corPorta: string, traco = 8): string {
  return `
    <path d="M30 98 L30 54 A30 30 0 0 1 90 54 L90 98"
          stroke="${corPorta}" stroke-width="${traco}" stroke-linecap="round"
          stroke-linejoin="round" fill="none"/>
    <g transform="translate(39.6,38.4) scale(1.7)">
      <path d="${HEART}" fill="${VERMELHO}"/>
    </g>`;
}

// Ícone quadrado. `respiro` afasta o desenho das bordas — o Android corta o
// ícone "maskable" em círculo, então ele precisa de margem extra.
function svgIcone(respiro: number, raio: number): string {
  const escala = (120 - respiro * 2) / 120;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <rect width="120" height="120" rx="${raio}" fill="${NAVY}"/>
    <g transform="translate(${respiro},${respiro}) scale(${escala})">${marca("#FFFFFF")}</g>
  </svg>`;
}

// Imagem de compartilhamento (Open Graph) — 1200×630.
const svgOg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="brilho" cx="18%" cy="28%" r="75%">
      <stop offset="0%" stop-color="#173D7A"/>
      <stop offset="100%" stop-color="${NAVY}"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#brilho)"/>

  <!-- Marca (centrada verticalmente com o bloco de texto ao lado) -->
  <g transform="translate(92,206) scale(2.05)">${marca("#FFFFFF", 7)}</g>

  <!-- Assinatura -->
  <text x="360" y="214" fill="#C9D4E8" font-family="Segoe UI, Arial, sans-serif"
        font-size="30" font-weight="600" letter-spacing="12">MINISTÉRIO</text>
  <text x="360" y="308" fill="#FFFFFF" font-family="Segoe Script, Brush Script MT, cursive"
        font-size="104" font-weight="700">Ágape</text>

  <!-- Filete dourado -->
  <rect x="362" y="348" width="120" height="5" rx="2.5" fill="${DOURADO}"/>

  <!-- Frase da marca (texto pedido para o OG) -->
  <text x="360" y="426" fill="#FFFFFF" font-family="Georgia, serif"
        font-size="46" font-style="italic">Recebendo a Todos com Muito Amor.</text>

  <!-- Rodapé -->
  <text x="360" y="492" fill="#9FB2CF" font-family="Segoe UI, Arial, sans-serif"
        font-size="27">Igreja Batista Casa de Deus · Jundiaí/SP</text>
</svg>`;

async function png(svg: string, tamanho: number, destino: string) {
  await sharp(Buffer.from(svg)).resize(tamanho, tamanho).png().toFile(destino);
  console.log(`  ${destino} (${tamanho}×${tamanho})`);
}

async function main() {
  const raiz = process.cwd();
  const publicIcons = join(raiz, "public", "icons");
  mkdirSync(publicIcons, { recursive: true });

  // Ícones quadrados (cantos arredondados; o maskable leva respiro maior).
  await png(svgIcone(0, 26), 180, join(raiz, "src", "app", "apple-icon.png"));
  await png(svgIcone(0, 26), 192, join(publicIcons, "icon-192.png"));
  await png(svgIcone(0, 26), 512, join(publicIcons, "icon-512.png"));
  await png(svgIcone(14, 60), 512, join(publicIcons, "maskable-512.png"));

  // Open Graph 1200×630.
  const destinoOg = join(raiz, "src", "app", "opengraph-image.png");
  await sharp(Buffer.from(svgOg)).png().toFile(destinoOg);
  console.log(`  ${destinoOg} (1200×630)`);

  // Guarda o SVG da OG para conferência/ajuste futuro.
  writeFileSync(join(raiz, "public", "icons", "og-fonte.svg"), svgOg, "utf8");
  console.log("\nÍcones e OG image gerados.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
