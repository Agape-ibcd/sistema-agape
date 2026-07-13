import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

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
  return (
    // suppressHydrationWarning: o script acima pode adicionar `dark` ao <html>
    // antes da hidratação — divergência esperada e proposital.
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
