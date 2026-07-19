// Rodapé padrão — presente em todas as telas. O slogan da marca é o
// protagonista (serif itálico, corpo maior); o crédito Lebrai fica discreto
// numa linha só, em corpo menor (brilho neon dourado só no hover).
export function Rodape() {
  return (
    <footer className="border-t border-edge-soft px-4 py-5 text-center">
      <p className="font-serif text-lg italic text-ink-soft sm:text-xl">
        Recebendo a Todos com Muito Amor.
      </p>
      <p className="mt-2 text-[11px] text-ink-faint">
        Ministério Ágape — Gestão com IA, sob a expertise da Lebrai.
      </p>
      <a
        href="https://www.lebrai.com.br"
        target="_blank"
        rel="noopener noreferrer"
        className="link-lebrai mt-1 inline-flex items-center gap-1.5 align-middle"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- logo estático leve */}
        <img
          src="/logo_lebrai.png"
          alt="Lebrai"
          className="lebrai-logo h-4 w-auto rounded ring-1 ring-edge-soft"
        />
        <span className="lebrai-site text-[11px] font-medium text-warn-text">
          www.lebrai.com.br
        </span>
      </a>
    </footer>
  );
}
