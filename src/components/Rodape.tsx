// Rodapé padrão com o crédito do desenvolvedor — presente em todas as telas.
export function Rodape() {
  return (
    <footer className="border-t border-edge-soft px-4 py-3 text-center text-xs text-ink-subtle">
      Sistema Ágape · desenvolvido por{" "}
      <a
        href="https://www.lebrai.com.br"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-brand-text underline-offset-2 hover:underline"
      >
        www.lebrai.com.br
      </a>
    </footer>
  );
}
