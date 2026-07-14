// Rodapé padrão — presente em todas as telas. Slogan da marca + crédito Lebrai
// (logo + site em dourado com brilho neon ao passar o mouse).
export function Rodape() {
  return (
    <footer className="border-t border-edge-soft px-4 py-4 text-center text-xs text-ink-subtle">
      <p className="font-serif text-sm italic text-ink-soft">
        Recebendo a Todos com Muito Amor.
      </p>
      <p className="mt-1.5">
        Ministério Ágape — Gestão com IA, sob a expertise da Lebrai.
      </p>
      <a
        href="https://www.lebrai.com.br"
        target="_blank"
        rel="noopener noreferrer"
        className="link-lebrai mt-1.5 inline-flex items-center gap-2 align-middle"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- logo estático leve */}
        <img
          src="/logo_lebrai.png"
          alt="Lebrai"
          className="lebrai-logo h-6 w-auto rounded-md ring-1 ring-edge-soft"
        />
        <span className="lebrai-site text-sm font-semibold text-warn">
          www.lebrai.com.br
        </span>
      </a>
    </footer>
  );
}
