// Coração pulsando reutilizável — mesmo SVG/animação do IndicadorNavegacao
// (globals.css: .coracao-pulsar), usado aqui para o estado de "sem dado
// ainda" de componentes que buscam dados no cliente (ex.: DashboardDados).
export function CoracaoCarregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        style={{ fill: "var(--accent)" }}
        aria-hidden
        className="coracao-pulsar"
      >
        <path d="M12 21s-6.7-4.35-9.3-8.3C.8 9.7 1.6 6.4 4.4 5 6.6 3.9 9 4.6 12 7.3 15 4.6 17.4 3.9 19.6 5c2.8 1.4 3.6 4.7 1.7 7.7C18.7 16.65 12 21 12 21z" />
      </svg>
      <p className="text-sm text-ink-subtle">{texto}</p>
    </div>
  );
}
