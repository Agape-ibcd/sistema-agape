import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Ministério Ágape",
  description: "Sistema de gestão do Ministério Ágape — Igreja Batista Casa de Deus, Jundiaí/SP",
};

// Aplica a classe `dark` antes da primeira pintura (sem flash de tema errado):
// escolha salva em localStorage("tema"); sem escolha, segue o sistema.
const scriptTema = `(function(){try{var t=localStorage.getItem("tema");var e=t?t==="escuro":matchMedia("(prefers-color-scheme: dark)").matches;if(e)document.documentElement.classList.add("dark")}catch(_){}})()`;

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
