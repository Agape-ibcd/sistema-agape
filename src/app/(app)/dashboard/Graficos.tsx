"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  LabelList,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type {
  SerieEquipe,
  SerieTipo,
  SerieEvento,
  Composicao,
} from "@/lib/dashboard";
import { useTema } from "@/components/ThemeProvider";
import { coresGraficos } from "@/lib/coresGraficos";

// Gráficos do dashboard (client — Recharts). Recebem apenas dados serializáveis.
// Paleta Ágape (theme-aware via coresGraficos). Mobile-first: cada gráfico ocupa
// 100% da largura do cartão.

function Cartao({
  titulo,
  children,
  vazio,
  acao,
}: {
  titulo: string;
  children: React.ReactNode;
  vazio: boolean;
  acao?: React.ReactNode; // botão opcional no cabeçalho (ex.: compartilhar)
}) {
  return (
    <div className="rounded-2xl border border-edge-soft bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
        {acao}
      </div>
      {vazio ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-ink-faint">
          Sem dados no período/seleção.
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function fmtPct(v: number) {
  return `${v.toFixed(1)}%`;
}

// ── Tooltip do gráfico por tipo de culto: quebra por equipe escalada ──────
function TooltipTipo({
  active,
  payload,
  fundo,
  borda,
  texto,
  muted,
}: {
  active?: boolean;
  payload?: { payload: SerieTipo }[];
  fundo: string;
  borda: string;
  texto: string;
  muted: string;
}) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div
      style={{
        background: fundo,
        border: `1px solid ${borda}`,
        borderRadius: 12,
        padding: "10px 12px",
        color: texto,
        fontSize: 12,
        minWidth: 220,
        boxShadow: "0 6px 24px rgba(26,26,26,.12)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{s.nome}</div>
      <div style={{ color: muted }}>
        {fmtPct(s.taxaPresenca)} · {s.presentes} de {s.convocacoes} presentes
      </div>
      <div
        style={{
          marginTop: 8,
          paddingTop: 6,
          borderTop: `1px solid ${borda}`,
          fontWeight: 600,
        }}
      >
        Equipes escaladas
      </div>
      {s.equipes.map((e) => (
        <div
          key={e.equipeId}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            marginTop: 3,
          }}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 150,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 999,
                background: e.corHex ?? "#a1a1aa",
                marginRight: 6,
              }}
            />
            {e.nome}
          </span>
          <span style={{ color: muted, whiteSpace: "nowrap" }}>
            {e.presentes}/{e.convocacoes} · {fmtPct(e.taxaPresenca)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Compartilhar o gráfico por tipo como imagem (PNG) ─────────────────────
// Desenha um relatório em canvas (sempre claro) com o período, as barras por
// tipo, o detalhamento por equipe e o crédito — e compartilha/baixa o PNG.
async function gerarImagemTipos(
  porTipo: SerieTipo[],
  periodo: string,
): Promise<File> {
  const W = 1080;
  const PADX = 64;
  const HEADER = 176;
  const FOOTER = 96;
  const alturaBloco = (t: SerieTipo) => 96 + t.equipes.length * 30;
  const corpo = porTipo.reduce((acc, t) => acc + alturaBloco(t) + 20, 0);
  const H = HEADER + corpo + FOOTER;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");

  try {
    await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts
      ?.ready;
  } catch {
    /* fontes podem não estar prontas — segue com o fallback */
  }

  // Fundo
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Cabeçalho
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#3a3a3a";
  ctx.font = "600 20px Montserrat, sans-serif";
  ctx.fillText("MINISTÉRIO ÁGAPE", PADX, 60);
  ctx.fillStyle = "#0d2b5c";
  ctx.font = "700 42px Oswald, 'Arial Narrow', sans-serif";
  ctx.fillText("PRESENÇA POR TIPO DE CULTO", PADX, 110);
  ctx.fillStyle = "#6b6b6b";
  ctx.font = "400 24px Montserrat, sans-serif";
  ctx.fillText(`Período: ${periodo}`, PADX, 146);
  ctx.strokeStyle = "#e3e1dc";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADX, HEADER - 8);
  ctx.lineTo(W - PADX, HEADER - 8);
  ctx.stroke();

  // Blocos por tipo
  const larguraBarra = W - PADX * 2;
  let y = HEADER + 16;
  for (const t of porTipo) {
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "600 26px Oswald, 'Arial Narrow', sans-serif";
    ctx.fillText(t.nome.toUpperCase(), PADX, y + 24);

    ctx.fillStyle = "#3a3a3a";
    ctx.font = "600 22px Montserrat, sans-serif";
    const resumo = `${fmtPct(t.taxaPresenca)} · ${t.presentes}/${t.convocacoes}`;
    ctx.textAlign = "right";
    ctx.fillText(resumo, W - PADX, y + 24);
    ctx.textAlign = "left";

    // Barra
    const barY = y + 38;
    ctx.fillStyle = "#eceae4";
    roundRect(ctx, PADX, barY, larguraBarra, 16, 8);
    ctx.fill();
    ctx.fillStyle = "#2e7d52";
    roundRect(
      ctx,
      PADX,
      barY,
      Math.max(6, (larguraBarra * t.taxaPresenca) / 100),
      16,
      8,
    );
    ctx.fill();

    // Equipes
    let ey = barY + 42;
    ctx.font = "400 20px Montserrat, sans-serif";
    for (const e of t.equipes) {
      ctx.fillStyle = e.corHex ?? "#a1a1aa";
      ctx.beginPath();
      ctx.arc(PADX + 6, ey - 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a3a3a";
      ctx.fillText(e.nome, PADX + 20, ey);
      ctx.fillStyle = "#6b6b6b";
      ctx.textAlign = "right";
      ctx.fillText(
        `${e.presentes}/${e.convocacoes} · ${fmtPct(e.taxaPresenca)}`,
        W - PADX,
        ey,
      );
      ctx.textAlign = "left";
      ey += 30;
    }
    y += alturaBloco(t) + 20;
  }

  // Rodapé
  ctx.strokeStyle = "#e3e1dc";
  ctx.beginPath();
  ctx.moveTo(PADX, H - FOOTER + 20);
  ctx.lineTo(W - PADX, H - FOOTER + 20);
  ctx.stroke();
  ctx.fillStyle = "#6b6b6b";
  ctx.font = "500 22px Montserrat, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    "Ministério Ágape - Casa de Deus Jundiaí. By lebrai.com.br",
    W / 2,
    H - 34,
  );
  ctx.textAlign = "left";

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem."))),
      "image/png",
    ),
  );
  return new File([blob], "presenca-por-tipo.png", { type: "image/png" });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const raio = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, raio);
}

function BotaoCompartilhar({
  porTipo,
  periodo,
}: {
  porTipo: SerieTipo[];
  periodo: string;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(false);

  async function compartilhar() {
    setErro(false);
    setOcupado(true);
    try {
      const arquivo = await gerarImagemTipos(porTipo, periodo);
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({
          files: [arquivo],
          title: "Presença por tipo de culto — Ministério Ágape",
        });
      } else {
        baixar(arquivo);
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        // Se o compartilhamento falhar, tenta o download como alternativa.
        try {
          baixar(await gerarImagemTipos(porTipo, periodo));
        } catch {
          setErro(true);
        }
      }
    } finally {
      setOcupado(false);
    }
  }

  function baixar(arquivo: File) {
    const url = URL.createObjectURL(arquivo);
    const a = document.createElement("a");
    a.href = url;
    a.download = arquivo.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      disabled={ocupado}
      title="Compartilhar como imagem (com o período e os dados por equipe)"
      className="shrink-0 rounded-lg border border-edge px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-brand-edge hover:bg-brand-faint hover:text-brand-text disabled:opacity-60"
    >
      {ocupado ? "Gerando…" : erro ? "Erro — tentar de novo" : "Compartilhar 📤"}
    </button>
  );
}

export function GraficosDashboard({
  porEquipe,
  porTipo,
  porEvento,
  composicao,
  mostrarEquipes,
  periodo,
}: {
  porEquipe: SerieEquipe[];
  porTipo: SerieTipo[];
  porEvento: SerieEvento[];
  composicao: Composicao;
  // Líder/membro têm uma só equipe — o gráfico por equipe fica redundante.
  mostrarEquipes: boolean;
  periodo: string; // "dd/mm/aaaa a dd/mm/aaaa" — usado no relatório compartilhado
}) {
  const { tema } = useTema();
  const cores = coresGraficos(tema);
  const eixoPct = { fontSize: 11, fill: cores.eixo };
  const tooltipStyle = {
    fontSize: 12,
    borderRadius: 12,
    border: `1px solid ${cores.tooltipBorda}`,
    backgroundColor: cores.tooltipFundo,
    color: cores.tooltipTexto,
  };
  // Recharts colore cada item do tooltip com a cor da própria série (ex.:
  // corHex da equipe), que pode ficar ilegível sobre o fundo escuro do tema
  // dark. Forçamos o texto do item para a cor de tooltip do tema.
  const tooltipItemStyle = { color: cores.tooltipTexto };
  const tooltipLabelStyle = { color: cores.tooltipTexto };

  const dadosComposicao = [
    { nome: "Pontuais", valor: composicao.pontuais, cor: cores.pontual },
    { nome: "Atrasados", valor: composicao.atrasados, cor: cores.atraso },
    { nome: "Ausentes", valor: composicao.ausentes, cor: cores.ausencia },
  ].filter((d) => d.valor > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Presença por tipo de culto — PRIMEIRO gráfico. Barra mostra o nº de
          presentes; o hover detalha as equipes escaladas; botão compartilha. */}
      <Cartao
        titulo="Presença por tipo de culto (%)"
        vazio={porTipo.length === 0}
        acao={
          porTipo.length > 0 ? (
            <BotaoCompartilhar porTipo={porTipo} periodo={periodo} />
          ) : undefined
        }
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={porTipo}
            margin={{ top: 20, right: 8, left: -16, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={cores.grade} />
            <XAxis
              dataKey="nome"
              tick={eixoPct}
              interval={0}
              tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 12) + "…" : v)}
            />
            <YAxis domain={[0, 100]} tick={eixoPct} />
            <Tooltip
              cursor={{ fill: "rgba(13,43,92,.06)" }}
              content={(props) => (
                <TooltipTipo
                  active={props.active}
                  payload={
                    props.payload as unknown as { payload: SerieTipo }[]
                  }
                  fundo={cores.tooltipFundo}
                  borda={cores.tooltipBorda}
                  texto={cores.tooltipTexto}
                  muted={cores.eixo}
                />
              )}
            />
            <Bar
              dataKey="taxaPresenca"
              fill={cores.presenca}
              radius={[6, 6, 0, 0]}
              isAnimationActive={false}
            >
              {/* Nº de presentes acima da barra */}
              <LabelList
                dataKey="presentes"
                position="top"
                style={{ fill: cores.eixo, fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Cartao>

      {mostrarEquipes && (
        <Cartao titulo="Presença por equipe (%)" vazio={porEquipe.length === 0}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={porEquipe}
              margin={{ top: 8, right: 8, left: -16, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={cores.grade} />
              <XAxis
                dataKey="nome"
                tick={eixoPct}
                interval={0}
                tickFormatter={(v: string) => (v.length > 10 ? v.slice(0, 10) + "…" : v)}
              />
              <YAxis domain={[0, 100]} tick={eixoPct} />
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
                formatter={(v) => [fmtPct(Number(v)), "Presença"]}
              />
              <Bar
                dataKey="taxaPresenca"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              >
                {porEquipe.map((e) => (
                  <Cell key={e.equipeId} fill={e.corHex ?? cores.presenca} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Cartao>
      )}

      <Cartao
        titulo="Evolução da presença por evento (%)"
        vazio={porEvento.length === 0}
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart
            data={porEvento}
            margin={{ top: 8, right: 12, left: -16, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={cores.grade} />
            <XAxis
              dataKey="data"
              tick={eixoPct}
              tickFormatter={(v: string) => v.slice(5).split("-").reverse().join("/")}
            />
            <YAxis domain={[0, 100]} tick={eixoPct} />
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              labelFormatter={(_, payload) =>
                (payload?.[0]?.payload as SerieEvento | undefined)?.rotulo ?? ""
              }
              formatter={(v) => [fmtPct(Number(v)), "Presença"]}
            />
            <Line
              type="monotone"
              dataKey="taxaPresenca"
              stroke={cores.linha}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Cartao>

      <Cartao
        titulo="Composição das convocações"
        vazio={dadosComposicao.length === 0}
      >
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={dadosComposicao}
              dataKey="valor"
              nameKey="nome"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={80}
              paddingAngle={2}
              isAnimationActive={false}
            >
              {dadosComposicao.map((d) => (
                <Cell key={d.nome} fill={d.cor} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              formatter={(v, n) => [`${Number(v)} lançamento(s)`, n]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </Cartao>
    </div>
  );
}
