// Logo do Ministério Ágape — "A porta do coração": um portal arqueado (a porta
// da Casa de Deus) acolhendo um coração, ao lado da assinatura em script.
// Portado do Design System oficial (brandbook/Logo.jsx).
//
// Cores por token: porta = --brand (navy, clareia no tema escuro),
// coração = --accent (Vermelho Ágape). Assim o logo adapta-se aos dois temas.
//
// ⚠️ Marca recém-desenhada pelo Design System (a igreja não tinha logo oficial)
// — validar com o ministério antes da adoção definitiva.

const HEART =
  "M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21Z";

// Símbolo (porta + coração).
export function AgapeMark({
  size = 40,
  stroke = 7,
  className,
}: {
  size?: number;
  stroke?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-label="Ágape"
      className={className}
    >
      <path
        d="M30 98 L30 54 A30 30 0 0 1 90 54 L90 98"
        stroke="var(--brand)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g transform="translate(39.6,38.4) scale(1.7)">
        <path d={HEART} fill="var(--accent)" />
      </g>
    </svg>
  );
}

// Lockup horizontal: símbolo + "MINISTÉRIO" / "Ágape" (script). Usado no menu
// e no login. `subtitulo` opcional (ex.: "Painel de acolhimento").
export function AgapeLogo({
  markSize = 44,
  subtitulo,
  className = "",
}: {
  markSize?: number;
  subtitulo?: string;
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <AgapeMark size={markSize} />
      <span className="flex flex-col leading-none">
        <span
          className="font-semibold uppercase text-ink-soft"
          style={{ letterSpacing: "0.34em", fontSize: markSize * 0.2 }}
        >
          Ministério
        </span>
        <span
          className="font-script text-accent-text"
          style={{ fontSize: markSize * 0.7, lineHeight: 1.05 }}
        >
          Ágape
        </span>
        {subtitulo && (
          <span className="mt-0.5 text-xs text-ink-subtle">{subtitulo}</span>
        )}
      </span>
    </div>
  );
}
