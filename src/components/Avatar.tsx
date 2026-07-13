// Foto do membro (redonda) com fallback para as iniciais do nome.
export function Avatar({
  nome,
  fotoUrl,
  tamanho = 40,
}: {
  nome: string;
  fotoUrl: string | null;
  tamanho?: number;
}) {
  const iniciais = nome
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .filter((_, i, arr) => i === 0 || i === arr.length - 1)
    .join("")
    .toUpperCase();

  if (fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- foto externa (Supabase Storage) já em 300×300
      <img
        src={fotoUrl}
        alt={`Foto de ${nome}`}
        width={tamanho}
        height={tamanho}
        className="shrink-0 rounded-full object-cover"
        style={{ width: tamanho, height: tamanho }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-text"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.38 }}
    >
      {iniciais || "?"}
    </span>
  );
}
