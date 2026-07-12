import "server-only";
import ExcelJS from "exceljs";
import type {
  DesempenhoMembro,
  RegistroDetalhado,
  SerieEquipe,
  SerieTipo,
} from "@/lib/dashboard";
import type { Aniversariante } from "@/lib/aniversariantes";

// ─────────────────────────────────────────────────────────────────────────
// Geração de planilhas (exceljs) e CSV para as exportações da Etapa 5. Todas as
// funções recebem dados já calculados/filtrados pela lib de dashboard, de modo
// que o arquivo respeita exatamente os filtros da tela.
// ─────────────────────────────────────────────────────────────────────────

type Coluna = { header: string; key: string; width: number };

function novaPlanilha(nomeAba: string, colunas: Coluna[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Ágape";
  wb.created = new Date();
  const ws = wb.addWorksheet(nomeAba, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = colunas;
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle" };
  return { wb, ws };
}

async function bufferXlsx(wb: ExcelJS.Workbook): Promise<Uint8Array> {
  // writeBuffer() devolve o Buffer (não-genérico) do exceljs; normalizamos para
  // Uint8Array, que é o BodyInit aceito pelo Response e evita o choque de tipos
  // com o Buffer genérico do @types/node.
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

// ── Presença detalhada (inclui status excluído/restaurado, conforme PDF) ──
const COLS_PRESENCA: Coluna[] = [
  { header: "Data", key: "data", width: 12 },
  { header: "Evento", key: "evento", width: 26 },
  { header: "Tipo", key: "tipo", width: 18 },
  { header: "Equipe", key: "equipe", width: 30 },
  { header: "Membro", key: "membro", width: 30 },
  { header: "Situação", key: "situacao", width: 12 },
  { header: "Pontualidade", key: "pontualidade", width: 14 },
  { header: "Chegada", key: "chegada", width: 10 },
  { header: "Justificativa", key: "justificativa", width: 30 },
  { header: "Excluído?", key: "excluido", width: 10 },
  { header: "Excluído em", key: "excluidoEm", width: 20 },
  { header: "Motivo exclusão", key: "motivo", width: 28 },
  { header: "Restaurado em", key: "restauradoEm", width: 20 },
];

function linhaPresenca(r: RegistroDetalhado) {
  return {
    data: r.dataBR,
    evento: r.eventoNome,
    tipo: r.tipoEventoNome,
    equipe: r.equipeNome,
    membro: r.membroNome,
    situacao: r.situacao,
    pontualidade: r.pontualidade,
    chegada: r.horarioChegada,
    justificativa: r.justificativa,
    excluido: r.excluido ? "Sim" : "Não",
    excluidoEm: r.excluidoEmBR,
    motivo: r.motivoExclusao,
    restauradoEm: r.restauradoEmBR,
  };
}

export async function planilhaPresencas(
  registros: RegistroDetalhado[],
): Promise<Uint8Array> {
  const { wb, ws } = novaPlanilha("Presenças", COLS_PRESENCA);
  registros.forEach((r) => ws.addRow(linhaPresenca(r)));
  return bufferXlsx(wb);
}

// CSV com BOM + separador ";" (compatível com Excel pt-BR).
export function csvPresencas(registros: RegistroDetalhado[]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const linhas = [COLS_PRESENCA.map((c) => esc(c.header)).join(";")];
  for (const r of registros) {
    const l = linhaPresenca(r);
    linhas.push(COLS_PRESENCA.map((c) => esc((l as Record<string, string>)[c.key])).join(";"));
  }
  // BOM UTF-8 (escape explícito — o caractere literal se perde ao salvar) para
  // o Excel pt-BR reconhecer os acentos corretamente.
  const bom = String.fromCharCode(0xfeff);
  return bom + linhas.join("\r\n");
}

// ── Resumo por membro ─────────────────────────────────────────────────────
export async function planilhaResumoMembros(
  desempenho: DesempenhoMembro[],
): Promise<Uint8Array> {
  const { wb, ws } = novaPlanilha("Resumo por membro", [
    { header: "Membro", key: "nome", width: 30 },
    { header: "Equipe", key: "equipe", width: 30 },
    { header: "Convocações", key: "conv", width: 13 },
    { header: "Presenças", key: "pres", width: 11 },
    { header: "Ausências", key: "aus", width: 11 },
    { header: "Pontuais", key: "pont", width: 10 },
    { header: "Atrasados", key: "atr", width: 11 },
    { header: "% Presença", key: "taxaPres", width: 12 },
    { header: "% Pontualidade", key: "taxaPont", width: 15 },
  ]);
  desempenho.forEach((d) =>
    ws.addRow({
      nome: d.nome,
      equipe: d.equipeNome,
      conv: d.convocacoes,
      pres: d.presentes,
      aus: d.ausentes,
      pont: d.pontuais,
      atr: d.atrasados,
      taxaPres: Number(d.taxaPresenca.toFixed(1)),
      taxaPont: d.presentes > 0 ? Number(d.taxaPontualidade.toFixed(1)) : "",
    }),
  );
  return bufferXlsx(wb);
}

// ── Resumo por equipe ─────────────────────────────────────────────────────
export async function planilhaResumoEquipes(
  porEquipe: SerieEquipe[],
  porTipo: SerieTipo[],
): Promise<Uint8Array> {
  const { wb, ws } = novaPlanilha("Por equipe", [
    { header: "Equipe", key: "nome", width: 34 },
    { header: "Convocações", key: "conv", width: 13 },
    { header: "Presentes", key: "pres", width: 11 },
    { header: "% Presença", key: "taxa", width: 12 },
  ]);
  porEquipe.forEach((e) =>
    ws.addRow({
      nome: e.nome,
      conv: e.convocacoes,
      pres: e.presentes,
      taxa: Number(e.taxaPresenca.toFixed(1)),
    }),
  );

  const ws2 = wb.addWorksheet("Por tipo de culto", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws2.columns = [
    { header: "Tipo de culto", key: "nome", width: 24 },
    { header: "Convocações", key: "conv", width: 13 },
    { header: "Presentes", key: "pres", width: 11 },
    { header: "% Presença", key: "taxa", width: 12 },
  ];
  ws2.getRow(1).font = { bold: true };
  porTipo.forEach((t) =>
    ws2.addRow({
      nome: t.nome,
      conv: t.convocacoes,
      pres: t.presentes,
      taxa: Number(t.taxaPresenca.toFixed(1)),
    }),
  );
  return bufferXlsx(wb);
}

// ── Agenda / escalas ──────────────────────────────────────────────────────
export type LinhaAgenda = {
  dataBR: string;
  diaSemana: string;
  evento: string;
  tipo: string;
  inicio: string;
  chegada: string;
  status: string;
  equipes: string;
};

export async function planilhaAgenda(linhas: LinhaAgenda[]): Promise<Uint8Array> {
  const { wb, ws } = novaPlanilha("Agenda e escalas", [
    { header: "Data", key: "dataBR", width: 12 },
    { header: "Dia", key: "diaSemana", width: 14 },
    { header: "Evento", key: "evento", width: 26 },
    { header: "Tipo", key: "tipo", width: 18 },
    { header: "Início", key: "inicio", width: 8 },
    { header: "Chegada equipe", key: "chegada", width: 15 },
    { header: "Status", key: "status", width: 12 },
    { header: "Equipes escaladas", key: "equipes", width: 40 },
  ]);
  linhas.forEach((l) => ws.addRow(l));
  return bufferXlsx(wb);
}

// ── Aniversariantes ───────────────────────────────────────────────────────
export async function planilhaAniversariantes(
  lista: Aniversariante[],
  nomeMesRotulo: string,
): Promise<Uint8Array> {
  const { wb, ws } = novaPlanilha(`Aniversariantes ${nomeMesRotulo}`.slice(0, 31), [
    { header: "Dia", key: "dia", width: 6 },
    { header: "Data", key: "data", width: 10 },
    { header: "Nome", key: "nome", width: 32 },
    { header: "Equipe", key: "equipe", width: 30 },
    { header: "Idade que completa", key: "idade", width: 18 },
  ]);
  lista.forEach((a) =>
    ws.addRow({
      dia: a.dia,
      data: a.dataBR,
      nome: a.nome,
      equipe: a.equipeNome ?? "",
      idade: a.idadeQueCompleta ?? "",
    }),
  );
  return bufferXlsx(wb);
}

// ── Helpers de resposta HTTP ──────────────────────────────────────────────
const CT_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function respostaXlsx(buffer: Uint8Array, nomeArquivo: string): Response {
  // `Uint8Array<ArrayBufferLike>` não casa nominalmente com BodyInit (que exige
  // buffer concreto); o dado é sempre um buffer normal, então o cast é seguro.
  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": CT_XLSX,
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function respostaCsv(conteudo: string, nomeArquivo: string): Response {
  return new Response(conteudo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
