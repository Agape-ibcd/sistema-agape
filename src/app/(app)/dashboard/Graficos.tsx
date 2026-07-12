"use client";

import {
  BarChart,
  Bar,
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

// Gráficos do dashboard (client — Recharts). Recebem apenas dados serializáveis.
// Paleta coerente com o app: esmeralda (presença/pontual), âmbar (atraso), rosa
// (ausência). Mobile-first: cada gráfico ocupa 100% da largura do cartão.

const COR_PRESENCA = "#059669"; // emerald-600
const COR_PONTUAL = "#10b981"; // emerald-500
const COR_ATRASO = "#f59e0b"; // amber-500
const COR_AUSENCIA = "#f43f5e"; // rose-500
const COR_LINHA = "#0ea5e9"; // sky-500

function Cartao({
  titulo,
  children,
  vazio,
}: {
  titulo: string;
  children: React.ReactNode;
  vazio: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-900">{titulo}</h3>
      {vazio ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-zinc-400">
          Sem dados no período/seleção.
        </div>
      ) : (
        children
      )}
    </div>
  );
}

const eixoPct = { fontSize: 11, fill: "#71717a" };
const tooltipStyle = {
  fontSize: 12,
  borderRadius: 12,
  border: "1px solid #e4e4e7",
};

function fmtPct(v: number) {
  return `${v.toFixed(1)}%`;
}

export function GraficosDashboard({
  porEquipe,
  porTipo,
  porEvento,
  composicao,
  mostrarEquipes,
}: {
  porEquipe: SerieEquipe[];
  porTipo: SerieTipo[];
  porEvento: SerieEvento[];
  composicao: Composicao;
  // Líder/membro têm uma só equipe — o gráfico por equipe fica redundante.
  mostrarEquipes: boolean;
}) {
  const dadosComposicao = [
    { nome: "Pontuais", valor: composicao.pontuais, cor: COR_PONTUAL },
    { nome: "Atrasados", valor: composicao.atrasados, cor: COR_ATRASO },
    { nome: "Ausentes", valor: composicao.ausentes, cor: COR_AUSENCIA },
  ].filter((d) => d.valor > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {mostrarEquipes && (
        <Cartao titulo="Presença por equipe (%)" vazio={porEquipe.length === 0}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={porEquipe}
              margin={{ top: 8, right: 8, left: -16, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis
                dataKey="nome"
                tick={eixoPct}
                interval={0}
                tickFormatter={(v: string) => (v.length > 10 ? v.slice(0, 10) + "…" : v)}
              />
              <YAxis domain={[0, 100]} tick={eixoPct} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [fmtPct(Number(v)), "Presença"]}
              />
              <Bar
                dataKey="taxaPresenca"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              >
                {porEquipe.map((e) => (
                  <Cell key={e.equipeId} fill={e.corHex ?? COR_PRESENCA} />
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
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={porEvento}
            margin={{ top: 8, right: 12, left: -16, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis
              dataKey="data"
              tick={eixoPct}
              tickFormatter={(v: string) => v.slice(5).split("-").reverse().join("/")}
            />
            <YAxis domain={[0, 100]} tick={eixoPct} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(_, payload) =>
                (payload?.[0]?.payload as SerieEvento | undefined)?.rotulo ?? ""
              }
              formatter={(v) => [fmtPct(Number(v)), "Presença"]}
            />
            <Line
              type="monotone"
              dataKey="taxaPresenca"
              stroke={COR_LINHA}
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
        <ResponsiveContainer width="100%" height={220}>
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
              formatter={(v, n) => [`${Number(v)} lançamento(s)`, n]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </Cartao>

      <Cartao titulo="Presença por tipo de culto (%)" vazio={porTipo.length === 0}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={porTipo}
            margin={{ top: 8, right: 8, left: -16, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis
              dataKey="nome"
              tick={eixoPct}
              interval={0}
              tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 12) + "…" : v)}
            />
            <YAxis domain={[0, 100]} tick={eixoPct} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v) => [fmtPct(Number(v)), "Presença"]}
            />
            <Bar dataKey="taxaPresenca" fill={COR_PRESENCA} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Cartao>
    </div>
  );
}
