import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ministério Ágape",
  description: "Sistema de gestão do Ministério Ágape — Igreja Batista Casa de Deus, Jundiaí/SP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
