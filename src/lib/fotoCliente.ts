// Utilitário de foto no NAVEGADOR (client components): redimensiona a imagem
// escolhida para 300×300 (corte central "cover") — regra do PDF — e devolve
// um JPEG leve para o upload. Compartilhado pelo cadastro de membros e pelo
// próprio perfil.
export async function redimensionar300(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const lado = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - lado) / 2;
  const sy = (bitmap.height - lado) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 300;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  ctx.drawImage(bitmap, sx, sy, lado, lado, 0, 0, 300, 300);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao processar a imagem."))),
      "image/jpeg",
      0.85,
    );
  });
}

// Troca o arquivo do <input type="file"> pela versão 300×300 e devolve a URL
// de pré-visualização. Lança erro legível se a imagem não puder ser lida.
export async function prepararFotoInput(
  e: React.ChangeEvent<HTMLInputElement>,
): Promise<string | null> {
  const arquivo = e.target.files?.[0];
  if (!arquivo) return null;
  const blob = await redimensionar300(arquivo);
  const jpeg = new File([blob], "foto.jpg", { type: "image/jpeg" });
  const dt = new DataTransfer();
  dt.items.add(jpeg);
  e.target.files = dt.files; // o form envia a versão 300×300, não a original
  return URL.createObjectURL(blob);
}
