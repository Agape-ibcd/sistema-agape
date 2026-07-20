import type { Metadata, Viewport } from "next";
import { Oswald, Montserrat, Kaushan_Script, Cormorant_Garamond } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

// Tipografia da marca Ágape (Design System). Cada fonte expõe uma CSS var
// consumida pelos tokens em globals.css (@theme → font-display/-sans/-script/-serif).
//  • Oswald            — títulos condensados em caixa-alta (display)
//  • Montserrat        — corpo e UI (fonte padrão do app)
//  • Kaushan Script    — SÓ a assinatura "Ágape"
//  • Cormorant Garamond— versículos (serif itálico elegante)
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});
const kaushan = Kaushan_Script({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-kaushan",
  display: "swap",
});
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["italic", "normal"],
  variable: "--font-cormorant",
  display: "swap",
});

// Frase da marca — usada no card de compartilhamento (OG) e no manifesto.
const SLOGAN = "Recebendo a Todos com Muito Amor.";
const DESCRICAO = `${SLOGAN} Sistema de gestão do Ministério Ágape — Igreja Batista Casa de Deus, Jundiaí/SP.`;

// `metadataBase` resolve as URLs absolutas exigidas por og:image. Usa o
// domínio PÚBLICO da marca — de propósito não reaproveita APP_URL, que aponta
// para o endereço da Vercel e é consumido pelos scripts de cron/Telegram.
const URL_BASE = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://agape.lebrai.com.br"
).replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(URL_BASE),
  title: {
    default: "Ministério Ágape",
    template: "%s · Ministério Ágape",
  },
  description: DESCRICAO,
  applicationName: "Ministério Ágape",
  // O ícone/OG são resolvidos por convenção de arquivo (icon.svg,
  // apple-icon.png, opengraph-image.png em src/app).
  openGraph: {
    type: "website",
    siteName: "Ministério Ágape",
    title: "Ministério Ágape",
    description: DESCRICAO,
    locale: "pt_BR",
    url: URL_BASE,
  },
  twitter: {
    card: "summary_large_image",
    title: "Ministério Ágape",
    description: DESCRICAO,
  },
  // Nome do atalho quando adicionado à tela inicial do iOS.
  appleWebApp: {
    capable: true,
    title: "Ágape",
    statusBarStyle: "black-translucent",
  },
};

// Pinta a barra do navegador com o navy da marca (e o fundo escuro no tema escuro).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0D2B5C" },
    { media: "(prefers-color-scheme: dark)", color: "#101218" },
  ],
};

// Aplica a classe `dark` antes da primeira pintura (sem flash de tema errado).
// A escolha fica em localStorage("tema") e é PERSISTENTE: na primeira visita o
// tema do sistema é resolvido e GRAVADO, de modo que o app nunca mais troca de
// tema sozinho (ex.: modo escuro automático do celular ao anoitecer). Depois
// disso, só o botão de alternância muda o tema.
const scriptTema = `(function(){try{var t=localStorage.getItem("tema");if(t!=="claro"&&t!=="escuro"){t=matchMedia("(prefers-color-scheme: dark)").matches?"escuro":"claro";localStorage.setItem("tema",t)}if(t==="escuro")document.documentElement.classList.add("dark")}catch(_){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontVars = `${oswald.variable} ${montserrat.variable} ${kaushan.variable} ${cormorant.variable}`;
  return (
    // suppressHydrationWarning: o script acima pode adicionar `dark` ao <html>
    // antes da hidratação — divergência esperada e proposital.
    <html
      lang="pt-BR"
      className={`h-full antialiased ${fontVars}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
