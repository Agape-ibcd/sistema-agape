"use client";

import { useCallback, useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────
// Cartão de aniversário digital: moldura à escolha + foto + texto padrão
// editável, desenhados num canvas 1080×1080 (formato ideal p/ WhatsApp).
// Compartilha via Web Share API (celular) ou baixa o PNG (fallback).
// ─────────────────────────────────────────────────────────────────────────

export type DadosCartao = {
  nome: string;
  fotoUrl: string | null;
  dataBR: string; // "15/07"
  idadeQueCompleta: number | null;
};

type Moldura = {
  id: string;
  rotulo: string;
  // Gradiente de fundo e cor de destaque dos enfeites/textos.
  gradiente: [string, string];
  destaque: string;
  confete: string[];
};

const MOLDURAS: Moldura[] = [
  {
    id: "esmeralda",
    rotulo: "Esmeralda",
    gradiente: ["#065f46", "#059669"],
    destaque: "#047857",
    confete: ["#a7f3d0", "#fbbf24", "#ffffff", "#6ee7b7"],
  },
  {
    id: "festa",
    rotulo: "Festa",
    gradiente: ["#7c3aed", "#db2777"],
    destaque: "#7c3aed",
    confete: ["#fbbf24", "#38bdf8", "#f9a8d4", "#ffffff"],
  },
  {
    id: "dourado",
    rotulo: "Dourado",
    gradiente: ["#78350f", "#b45309"],
    destaque: "#b45309",
    confete: ["#fde68a", "#ffffff", "#fbbf24", "#fcd34d"],
  },
];

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

function textoPadrao(d: DadosCartao): string {
  return (
    `Parabéns, ${primeiroNome(d.nome)}! 🎉\n` +
    "Que Deus abençoe sua vida com saúde, alegria e muitas realizações. " +
    "É uma honra servir ao lado de você!"
  );
}

// Quebra o texto em linhas que caibam na largura máxima.
function quebrarLinhas(
  ctx: CanvasRenderingContext2D,
  texto: string,
  larguraMax: number,
): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (ctx.measureText(tentativa).width <= larguraMax) {
        atual = tentativa;
      } else {
        if (atual) linhas.push(atual);
        atual = palavra;
      }
    }
    linhas.push(atual);
  }
  return linhas;
}

function carregarImagem(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Storage público do Supabase envia CORS
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Desenha o cartão completo e retorna o canvas.
async function desenharCartao(
  dados: DadosCartao,
  moldura: Moldura,
  mensagem: string,
): Promise<HTMLCanvasElement> {
  const L = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = L;
  canvas.height = L;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");

  // Fundo em gradiente
  const grad = ctx.createLinearGradient(0, 0, L, L);
  grad.addColorStop(0, moldura.gradiente[0]);
  grad.addColorStop(1, moldura.gradiente[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, L, L);

  // Confetes decorativos (determinísticos, sem Math.random p/ o preview
  // não "piscar" a cada redesenho)
  const pontos = [
    [90, 130, 16], [210, 70, 10], [960, 110, 14], [1010, 240, 9],
    [70, 950, 12], [160, 1010, 8], [930, 980, 15], [1020, 880, 10],
    [540, 60, 9], [340, 1020, 10], [760, 1030, 8], [60, 540, 9],
    [1030, 560, 11],
  ] as const;
  pontos.forEach(([x, y, r], i) => {
    ctx.fillStyle = moldura.confete[i % moldura.confete.length];
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Cartão interno branco arredondado
  const m = 84; // margem
  const raio = 48;
  ctx.beginPath();
  ctx.roundRect(m, m, L - 2 * m, L - 2 * m, raio);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Foto (círculo com anel) ou iniciais
  const cx = L / 2;
  const cyFoto = 320;
  const rFoto = 130;
  ctx.beginPath();
  ctx.arc(cx, cyFoto, rFoto + 10, 0, Math.PI * 2);
  ctx.fillStyle = moldura.destaque;
  ctx.fill();

  const img = dados.fotoUrl ? await carregarImagem(dados.fotoUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cyFoto, rFoto, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    ctx.drawImage(img, cx - rFoto, cyFoto - rFoto, rFoto * 2, rFoto * 2);
  } else {
    ctx.fillStyle = "#ecfdf5";
    ctx.fillRect(cx - rFoto, cyFoto - rFoto, rFoto * 2, rFoto * 2);
    ctx.fillStyle = moldura.destaque;
    ctx.font = "bold 110px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const iniciais = dados.nome
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .filter((_, i, arr) => i === 0 || i === arr.length - 1)
      .join("")
      .toUpperCase();
    ctx.fillText(iniciais || "🎂", cx, cyFoto + 8);
  }
  ctx.restore();

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // "Feliz aniversário!"
  ctx.fillStyle = moldura.destaque;
  ctx.font = "bold 44px system-ui, sans-serif";
  ctx.fillText("FELIZ ANIVERSÁRIO!", cx, 530);

  // Nome (reduz a fonte se não couber)
  ctx.fillStyle = "#18181b";
  let fonteNome = 64;
  ctx.font = `bold ${fonteNome}px system-ui, sans-serif`;
  while (ctx.measureText(dados.nome).width > L - 2 * m - 80 && fonteNome > 34) {
    fonteNome -= 4;
    ctx.font = `bold ${fonteNome}px system-ui, sans-serif`;
  }
  ctx.fillText(dados.nome, cx, 600);

  // Data e idade
  ctx.fillStyle = "#52525b";
  ctx.font = "34px system-ui, sans-serif";
  const idade =
    dados.idadeQueCompleta != null ? ` · ${dados.idadeQueCompleta} anos` : "";
  ctx.fillText(`${dados.dataBR}${idade}`, cx, 652);

  // Mensagem (limitada para caber no cartão)
  ctx.fillStyle = "#3f3f46";
  ctx.font = "36px system-ui, sans-serif";
  const linhas = quebrarLinhas(ctx, mensagem, L - 2 * m - 120).slice(0, 6);
  const alturaLinha = 50;
  let y = 730;
  for (const linha of linhas) {
    ctx.fillText(linha, cx, y);
    y += alturaLinha;
  }

  // Assinatura do ministério
  ctx.fillStyle = moldura.destaque;
  ctx.font = "bold 30px system-ui, sans-serif";
  ctx.fillText("Ministério Ágape", cx, L - m - 60);
  ctx.fillStyle = "#71717a";
  ctx.font = "26px system-ui, sans-serif";
  ctx.fillText("Igreja Batista Casa de Deus · Jundiaí/SP", cx, L - m - 22);

  return canvas;
}

export function CartaoAniversario({ dados }: { dados: DadosCartao }) {
  const [aberto, setAberto] = useState(false);
  const [molduraId, setMolduraId] = useState(MOLDURAS[0].id);
  const [mensagem, setMensagem] = useState(() => textoPadrao(dados));
  const [preview, setPreview] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const moldura = MOLDURAS.find((mo) => mo.id === molduraId) ?? MOLDURAS[0];

  // Redesenha o preview quando moldura/texto mudam (com o modal aberto).
  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        const canvas = await desenharCartao(dados, moldura, mensagem);
        if (!cancelado) setPreview(canvas.toDataURL("image/png"));
      } catch {
        if (!cancelado) setErro("Não foi possível desenhar o cartão.");
      }
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [aberto, dados, moldura, mensagem]);

  const gerarArquivo = useCallback(async (): Promise<File> => {
    const canvas = await desenharCartao(dados, moldura, mensagem);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem."))),
        "image/png",
      ),
    );
    const nomeArquivo = `aniversario-${primeiroNome(dados.nome).toLowerCase()}.png`;
    return new File([blob], nomeArquivo, { type: "image/png" });
  }, [dados, moldura, mensagem]);

  async function compartilhar() {
    setErro(null);
    setOcupado(true);
    try {
      const arquivo = await gerarArquivo();
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({
          files: [arquivo],
          title: `Feliz aniversário, ${primeiroNome(dados.nome)}!`,
        });
      } else {
        baixarArquivo(arquivo);
      }
    } catch (e) {
      // Cancelar o share nativo não é erro.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setErro("Não foi possível compartilhar — o cartão foi baixado.");
        try {
          baixarArquivo(await gerarArquivo());
        } catch {
          setErro("Não foi possível gerar o cartão.");
        }
      }
    } finally {
      setOcupado(false);
    }
  }

  function baixarArquivo(arquivo: File) {
    const url = URL.createObjectURL(arquivo);
    const a = document.createElement("a");
    a.href = url;
    a.download = arquivo.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function baixar() {
    setErro(null);
    setOcupado(true);
    try {
      baixarArquivo(await gerarArquivo());
    } catch {
      setErro("Não foi possível gerar o cartão.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="shrink-0 rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:border-brand-edge hover:bg-brand-faint hover:text-brand-text"
      >
        Cartão 🎉
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Cartão de aniversário de ${dados.nome}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
          onClick={() => setAberto(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-ink">
                Cartão de aniversário
              </h3>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-3"
              >
                ✕
              </button>
            </div>

            {/* Moldura */}
            <div className="mb-3 flex flex-wrap gap-2">
              {MOLDURAS.map((mo) => (
                <button
                  key={mo.id}
                  type="button"
                  onClick={() => setMolduraId(mo.id)}
                  aria-pressed={molduraId === mo.id}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                    molduraId === mo.id
                      ? "border-brand text-brand-text ring-1 ring-brand-ring"
                      : "border-edge text-ink-soft hover:bg-surface-2"
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-3.5 w-3.5 rounded-full"
                    style={{
                      background: `linear-gradient(135deg, ${mo.gradiente[0]}, ${mo.gradiente[1]})`,
                    }}
                  />
                  {mo.rotulo}
                </button>
              ))}
            </div>

            {/* Preview */}
            <div className="mb-3 overflow-hidden rounded-xl border border-edge-soft">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- preview gerado localmente
                <img src={preview} alt="Prévia do cartão" className="w-full" />
              ) : (
                <div className="flex aspect-square items-center justify-center text-sm text-ink-subtle">
                  Gerando prévia…
                </div>
              )}
            </div>

            {/* Texto editável */}
            <label
              htmlFor={`msg-${dados.nome}`}
              className="mb-1 block text-sm font-medium text-ink-soft"
            >
              Mensagem do cartão
            </label>
            <textarea
              id={`msg-${dados.nome}`}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={3}
              maxLength={280}
              className="w-full rounded-xl border border-edge px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
            />
            <div className="mt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setMensagem(textoPadrao(dados))}
                className="text-xs text-ink-subtle underline underline-offset-2 hover:text-ink-soft"
              >
                Restaurar texto padrão
              </button>
            </div>

            {erro && <p className="mt-2 text-xs text-danger-text">{erro}</p>}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={compartilhar}
                disabled={ocupado}
                className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
              >
                {ocupado ? "Gerando…" : "Compartilhar"}
              </button>
              <button
                type="button"
                onClick={baixar}
                disabled={ocupado}
                className="flex-1 rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-2 disabled:opacity-60"
              >
                Baixar PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
