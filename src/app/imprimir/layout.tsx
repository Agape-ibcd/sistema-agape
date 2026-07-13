// As rotas de impressão (→ "Salvar como PDF") saem SEMPRE no tema claro,
// independentemente do tema escolhido no app: `.tema-claro` força os tokens
// claros nesta subárvore (ver globals.css).
export default function ImprimirLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="tema-claro min-h-screen bg-surface">{children}</div>;
}
