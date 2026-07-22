import "dotenv/config";
import ExcelJS from "exceljs";
import { PrismaClient, Prisma } from "@prisma/client";
import type {
  TurnoEquipe,
  TipoRecorrencia,
  CategoriaEvento,
  Pontualidade,
} from "@prisma/client";
import path from "node:path";
import fs from "node:fs";

// ─────────────────────────────────────────────────────────────────────────
// Etapa 2 — Migração e saneamento de `Presença_Ágape.xlsx`.
//
// Lê as abas EQUIPES (43 membros) e PRESENÇA (360 registros), reconstrói
// tipos de evento / eventos / escalas a partir dos dados reais e importa as
// presenças DEDUPLICADAS por (evento, equipe, membro) mantendo o registro
// mais recente (maior Data Registro).
//
// Características:
//  - Idempotente: pode rodar de novo sem duplicar (casa membros por nome
//    normalizado, eventos por tipo+data, escalas/presenças por chave natural).
//  - Transacional: tudo dentro de uma transação. `--dry-run` executa toda a
//    lógica e faz ROLLBACK, útil para validar contagens sem tocar no banco.
//  - Não destrói a Etapa 1: as contas de teste do seed (admin@/membro@) ficam
//    intactas; Clayton e Erickson (que existem na planilha) são casados por
//    nome e apenas enriquecidos (equipe, nascimento, celular) — e-mail de
//    login, authUserId e nível de acesso preservados.
//
// Uso:
//    npx tsx scripts/migrate.ts --dry-run   # valida, não grava
//    npx tsx scripts/migrate.ts             # grava de verdade
// ─────────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");
const XLSX_PATH = path.resolve(process.cwd(), "Presença_Ágape.xlsx");
const REPORT_PATH = path.resolve(process.cwd(), "RELATORIO-MIGRACAO.md");

const prisma = new PrismaClient();

// Sentinela para abortar a transação no modo dry-run (força ROLLBACK).
const ROLLBACK = Symbol("dry-run-rollback");

// ───────────────────────────── Helpers de leitura ─────────────────────────

function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("text" in o) return String(o.text);
    if ("result" in o) return String(o.result);
    if ("richText" in o && Array.isArray(o.richText))
      return (o.richText as Array<{ text: string }>).map((r) => r.text).join("");
    if ("hyperlink" in o && "text" in o) return String(o.text);
    return "";
  }
  return String(v).trim();
}

// Normaliza nome para casamento idempotente: sem acentos, minúsculo, espaços
// colapsados. ("José Maria  Correa" → "jose maria correa")
function normNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Slug para e-mail sintético determinístico.
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const MESES_PT: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

// "8-mai.-1976" → Date(UTC 1976-05-08). Devolve null se não parsear.
function parseNascimento(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\s*-\s*([a-zç]{3,})\.?\s*-\s*(\d{4})$/i);
  if (!m) return null;
  const dia = parseInt(m[1], 10);
  const mesAbrev = m[2]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .slice(0, 3);
  const mes = MESES_PT[mesAbrev];
  const ano = parseInt(m[3], 10);
  if (!mes || dia < 1 || dia > 31) return null;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

// Célula de horário (Excel devolve Date "1899-12-30THH:MM:00Z") → "HH:MM".
// Texto ("No horário") ou vazio → null.
function parseHorario(v: unknown): string | null {
  if (v instanceof Date) {
    const hh = String(v.getUTCHours()).padStart(2, "0");
    const mm = String(v.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  return null;
}

// ───────────────────────────── Configuração de domínio ────────────────────

// As 4 equipes reais (mesmos nome/cor/turno do seed da Etapa 1). "Líder de
// Ministério" NÃO é equipe — é o papel do Erickson (super_admin, sem equipe).
const EQUIPES_DEF: { nome: string; turno: TurnoEquipe; cor: string }[] = [
  { nome: "Clayton & Janaína (Manhã)", turno: "manha", cor: "#2563eb" },
  { nome: "José Maria & Neusa | Guilherme & Thaís (Manhã)", turno: "manha", cor: "#16a34a" },
  { nome: "Geisa e Bell | Ednei & Darcilene (Noite)", turno: "noite", cor: "#9333ea" },
  { nome: "Fernando & Evânia (Noite)", turno: "noite", cor: "#dc2626" },
];
const TERMO_SEM_EQUIPE = "lider de ministerio"; // (normalizado) marca o Erickson na planilha

// Líderes identificados pelos nomes nos títulos das equipes → nome completo
// do membro correspondente (revisado manualmente a partir da planilha).
// Casos com premissa explícita (ver ASSUNCOES) são sinalizados no relatório.
const LIDERES_POR_EQUIPE: Record<string, string[]> = {
  "Clayton & Janaína (Manhã)": [
    "Clayton de Moraes Alves Silva",
    "Janaina Alves da Silva",
  ],
  "José Maria & Neusa | Guilherme & Thaís (Manhã)": [
    "José Maria Correa",
    "Neusa Correa",
    "Guilherme Arantes da Silva",
    "Thaís Pavan Arantes",
  ],
  "Geisa e Bell | Ednei & Darcilene (Noite)": [
    "Geisa Rirley de Oliveira",
    "Maria Izabel Oliveira da Silva", // "Bell" (premissa)
    "Ednei Barros Felix",
    "Darcilene Ap.Souza Felix",
  ],
  "Fernando & Evânia (Noite)": [
    "Fernando Barbosa", // dois "Fernando"; casado com Evânia Barbosa (premissa)
    "Evânia Santiago Barbosa",
  ],
};
const ASSUNCOES = [
  '"Bell" → **Maria Izabel Oliveira da Silva** (apelido; não há membro chamado "Bell"). Confirmar.',
  '"Fernando" (título "Fernando & Evânia") → **Fernando Barbosa** entre os dois Fernandos, por compartilhar o sobrenome Barbosa com Evânia Santiago Barbosa. Confirmar.',
];

// Culto (coluna da planilha) → template de TipoEvento. Horários provisórios,
// inferidos dos horários de chegada registrados + padrão da igreja; a relação
// chegada = início − 01:15 é respeitada. Ajustáveis na Etapa 3.
const TIPOS_DEF: Record<
  string,
  {
    inicio: string;
    chegada: string;
    recorrencia: TipoRecorrencia;
    categoria: CategoriaEvento;
    config: Prisma.InputJsonValue;
  }
> = {
  "Domingo Manhã": {
    inicio: "10:00", chegada: "08:45", recorrencia: "semanal",
    categoria: "culto_regular", config: { diaSemana: 0, turno: "manha" },
  },
  "Domingo Noite": {
    inicio: "18:00", chegada: "16:45", recorrencia: "semanal",
    categoria: "culto_regular", config: { diaSemana: 0, turno: "noite" },
  },
  "Quarta-feira": {
    inicio: "20:00", chegada: "18:45", recorrencia: "semanal",
    categoria: "culto_regular", config: { diaSemana: 3 },
  },
  "Evento Extra": {
    inicio: "20:00", chegada: "18:45", recorrencia: "avulso",
    categoria: "evento_extra", config: {},
  },
};

const DOMINIO_MEMBRO = "membros.agape.local"; // e-mails sintéticos

// ───────────────────────────── Tipos internos ─────────────────────────────

type SheetMembro = {
  email: string;
  equipe: string;
  nome: string;
  celular: string;
  nascimentoRaw: string;
  observacao: string;
};

type SheetPresenca = {
  dataReg: Date | null;
  dataCulto: Date | null;
  culto: string;
  desc: string;
  equipe: string;
  membro: string;
  presente: boolean;
  pontualidade: Pontualidade | null;
  horario: string | null;
  linha: number;
};

// ───────────────────────────── Leitura da planilha ────────────────────────

async function lerPlanilha(): Promise<{ membros: SheetMembro[]; presencas: SheetPresenca[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);

  const eq = wb.getWorksheet("EQUIPES");
  const pr = wb.getWorksheet("PRESENÇA") ?? wb.getWorksheet("PRESENCA");
  if (!eq || !pr) throw new Error("Abas EQUIPES/PRESENÇA não encontradas na planilha.");

  const membros: SheetMembro[] = [];
  for (let r = 2; r <= eq.rowCount; r++) {
    const row = eq.getRow(r);
    const nome = cellText(row.getCell(4).value);
    if (!nome) continue;
    membros.push({
      email: cellText(row.getCell(2).value).toLowerCase(),
      equipe: cellText(row.getCell(3).value),
      nome,
      celular: cellText(row.getCell(5).value),
      nascimentoRaw: cellText(row.getCell(6).value),
      observacao: cellText(row.getCell(7).value),
    });
  }

  const presencas: SheetPresenca[] = [];
  for (let r = 2; r <= pr.rowCount; r++) {
    const row = pr.getRow(r);
    const membro = cellText(row.getCell(6).value);
    if (!membro) continue;
    const presenteRaw = cellText(row.getCell(7).value).toUpperCase();
    const pontRaw = cellText(row.getCell(8).value).toUpperCase();
    const presente = presenteRaw === "SIM";
    const pontualidade: Pontualidade | null = !presente
      ? null
      : pontRaw === "PONTUAL"
        ? "pontual"
        : pontRaw === "ATRASADO"
          ? "atrasado"
          : null;
    presencas.push({
      dataReg: row.getCell(1).value instanceof Date ? (row.getCell(1).value as Date) : null,
      dataCulto: row.getCell(2).value instanceof Date ? (row.getCell(2).value as Date) : null,
      culto: cellText(row.getCell(3).value),
      desc: cellText(row.getCell(4).value),
      equipe: cellText(row.getCell(5).value),
      membro,
      presente,
      pontualidade,
      horario: presente ? parseHorario(row.getCell(9).value) : null,
      linha: r,
    });
  }

  return { membros, presencas };
}

// ───────────────────────────── Utilidades ─────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function eventoKey(p: { dataCulto: Date | null; culto: string; desc: string }): string {
  return `${p.dataCulto ? isoDate(p.dataCulto) : "?"}||${p.culto}||${p.desc}`;
}

// Acumulador de linhas do relatório.
const rel: string[] = [];
function log(linha = "") {
  console.log(linha);
  rel.push(linha);
}

// ───────────────────────────── Migração ───────────────────────────────────

async function main() {
  console.log(
    `\n=== Migração Etapa 2 ${DRY_RUN ? "(DRY-RUN — nada será gravado)" : "(GRAVAÇÃO REAL)"} ===\n`,
  );

  const { membros: sheetMembros, presencas: sheetPresencas } = await lerPlanilha();

  // Contagem de e-mails na planilha: um e-mail é "pessoal" apenas se aparecer
  // uma única vez (os repetidos são endereços de quem preencheu o formulário
  // em nome de vários membros — ex.: ericksonacrespim@ 12×, agape.ibcd@ 5×).
  const emailCount = new Map<string, number>();
  for (const m of sheetMembros)
    if (m.email) emailCount.set(m.email, (emailCount.get(m.email) ?? 0) + 1);

  rel.length = 0;
  rel.push(`# Relatório de Migração — Etapa 2`);
  rel.push(``);
  rel.push(`- **Modo:** ${DRY_RUN ? "DRY-RUN (rollback, nada gravado)" : "GRAVAÇÃO REAL"}`);
  rel.push(`- **Data:** ${new Date().toISOString()}`);
  rel.push(`- **Fonte:** \`${path.basename(XLSX_PATH)}\``);
  rel.push(``);

  await prisma.$transaction(
    async (tx) => {
      // ---------- 1. EQUIPES ----------
      log(`## 1. Equipes`);
      const equipePorNome = new Map<string, string>(); // nome → id
      for (const def of EQUIPES_DEF) {
        const existente = await tx.equipe.findFirst({ where: { nome: def.nome } });
        const reg = existente
          ? await tx.equipe.update({
              where: { id: existente.id },
              data: { turnoPadrao: def.turno, corHex: def.cor },
            })
          : await tx.equipe.create({
              data: { nome: def.nome, turnoPadrao: def.turno, corHex: def.cor },
            });
        equipePorNome.set(def.nome, reg.id);
        log(`- ${existente ? "reutilizada" : "criada"}: ${def.nome}`);
      }
      log();

      // ---------- 2. MEMBROS ----------
      log(`## 2. Membros`);
      const existentes = await tx.membro.findMany();
      const porNomeNorm = new Map<string, (typeof existentes)[number]>();
      for (const e of existentes) porNomeNorm.set(normNome(e.nomeCompleto), e);

      const membroIdPorNome = new Map<string, string>(); // normNome → membro.id
      const usados = new Set<string>(); // e-mails já atribuídos nesta execução
      let criados = 0, atualizados = 0, comEmailReal = 0, comEmailSintetico = 0;
      const detalheMembros: string[] = [];

      for (const sm of sheetMembros) {
        const key = normNome(sm.nome);
        const semEquipe = normNome(sm.equipe) === TERMO_SEM_EQUIPE;
        const equipeId = semEquipe ? null : equipePorNome.get(sm.equipe) ?? null;
        if (!semEquipe && !equipeId)
          throw new Error(`Equipe não reconhecida para ${sm.nome}: "${sm.equipe}"`);
        const nascimento = parseNascimento(sm.nascimentoRaw);
        const celular = sm.celular ? sm.celular.replace(/\D/g, "") || null : null;
        const observacao = sm.observacao || null;

        const existente = porNomeNorm.get(key);
        if (existente) {
          // Enriquecer sem tocar em e-mail de login / authUserId / nível.
          const reg = await tx.membro.update({
            where: { id: existente.id },
            data: {
              celularWhatsapp: celular ?? existente.celularWhatsapp,
              dataNascimento: nascimento ?? existente.dataNascimento,
              observacao: observacao ?? existente.observacao,
              // super_admin (Erickson) permanece sem equipe.
              equipeId: existente.nivelAcesso === "super_admin" ? existente.equipeId : equipeId,
            },
          });
          membroIdPorNome.set(key, reg.id);
          atualizados++;
          detalheMembros.push(`- atualizado: ${sm.nome} (${existente.nivelAcesso}, e-mail preservado ${existente.email})`);
        } else {
          // Definir e-mail: real só se singleton na planilha; senão sintético.
          let email: string;
          if (sm.email && emailCount.get(sm.email) === 1 && !usados.has(sm.email)) {
            email = sm.email;
            comEmailReal++;
          } else {
            email = `${slug(sm.nome)}@${DOMINIO_MEMBRO}`;
            comEmailSintetico++;
          }
          usados.add(email);
          const reg = await tx.membro.create({
            data: {
              email,
              nomeCompleto: sm.nome,
              celularWhatsapp: celular,
              dataNascimento: nascimento,
              observacao,
              equipeId,
              status: "ativo",
              nivelAcesso: "membro",
            },
          });
          membroIdPorNome.set(key, reg.id);
          criados++;
          detalheMembros.push(`- criado: ${sm.nome} (${email}${nascimento ? "" : " — ⚠ sem data de nascimento parseável"})`);
        }
      }
      log(`- planilha: ${sheetMembros.length} membros`);
      log(`- criados: ${criados} | atualizados (casados por nome): ${atualizados}`);
      log(`- e-mails: ${comEmailReal} reais (únicos na planilha) + ${comEmailSintetico} sintéticos @${DOMINIO_MEMBRO}`);
      log();

      // ---------- 3. LÍDERES (nível + EQUIPE_LIDERES) ----------
      log(`## 3. Líderes`);
      let vinculosCriados = 0, elevados = 0;
      for (const [equipeNome, lideres] of Object.entries(LIDERES_POR_EQUIPE)) {
        const equipeId = equipePorNome.get(equipeNome)!;
        for (const nomeLider of lideres) {
          const key = normNome(nomeLider);
          const membroId = membroIdPorNome.get(key);
          if (!membroId) {
            log(`- ⚠ líder não encontrado entre os membros: ${nomeLider} (${equipeNome})`);
            continue;
          }
          const membro = await tx.membro.findUnique({ where: { id: membroId } });
          if (membro && membro.nivelAcesso === "membro") {
            await tx.membro.update({
              where: { id: membroId },
              data: { nivelAcesso: "lider", equipeId },
            });
            elevados++;
          }
          const jaVinculo = await tx.equipeLider.findFirst({
            where: { equipeId, membroId, dataFim: null },
          });
          if (!jaVinculo) {
            await tx.equipeLider.create({ data: { equipeId, membroId } });
            vinculosCriados++;
          }
          log(`- ${equipeNome} ← ${nomeLider}`);
        }
      }
      log(`- vínculos EQUIPE_LIDERES criados: ${vinculosCriados} | elevados a "lider": ${elevados}`);
      log();

      // ---------- 4. Órfãos (presença sem cadastro) → membros inativos ----------
      log(`## 4. Membros órfãos (presentes na planilha PRESENÇA, ausentes em EQUIPES)`);
      const nomesConhecidos = new Set(sheetMembros.map((m) => normNome(m.nome)));
      const orfaos = new Map<string, string>(); // normNome → equipe (1ª ocorrência)
      for (const p of sheetPresencas) {
        const key = normNome(p.membro);
        if (!nomesConhecidos.has(key) && !orfaos.has(key)) orfaos.set(key, p.equipe);
      }
      // resolver nome original (preservando grafia) por normNome
      const nomeOriginalOrfao = new Map<string, string>();
      for (const p of sheetPresencas) {
        const key = normNome(p.membro);
        if (orfaos.has(key) && !nomeOriginalOrfao.has(key)) nomeOriginalOrfao.set(key, p.membro);
      }
      let orfaosCriados = 0;
      for (const [key, equipeNome] of orfaos) {
        const nome = nomeOriginalOrfao.get(key)!;
        const equipeId = equipePorNome.get(equipeNome) ?? null;
        const existente = porNomeNorm.get(key);
        if (existente) {
          membroIdPorNome.set(key, existente.id);
          continue;
        }
        const reg = await tx.membro.create({
          data: {
            email: `${slug(nome)}@${DOMINIO_MEMBRO}`,
            nomeCompleto: nome,
            equipeId,
            status: "inativo", // não constam no quadro atual
            nivelAcesso: "membro",
          },
        });
        membroIdPorNome.set(key, reg.id);
        orfaosCriados++;
        log(`- criado INATIVO: ${nome} → ${equipeNome}`);
      }
      if (orfaosCriados === 0) log(`- nenhum novo órfão a criar.`);
      log();

      // ator da migração (Erickson super_admin) para os campos *_por
      const erickson = await tx.membro.findFirst({ where: { nivelAcesso: "super_admin" } });
      const atorId = erickson?.id ?? null;

      // ---------- 5. TIPOS_EVENTO ----------
      log(`## 5. Tipos de evento`);
      const tipoIdPorCulto = new Map<string, string>();
      const cultosNaPlanilha = [...new Set(sheetPresencas.map((p) => p.culto))];
      for (const culto of cultosNaPlanilha) {
        const def = TIPOS_DEF[culto];
        if (!def) throw new Error(`Sem template de TipoEvento para culto "${culto}"`);
        let tipo = await tx.tipoEvento.findFirst({ where: { nome: culto } });
        if (!tipo) {
          tipo = await tx.tipoEvento.create({
            data: {
              nome: culto,
              horarioInicio: def.inicio,
              horarioChegadaEquipe: def.chegada,
              tipoRecorrencia: def.recorrencia,
              configRecorrencia: def.config,
              categoria: def.categoria,
              criadoPor: atorId,
            },
          });
        }
        tipoIdPorCulto.set(culto, tipo.id);
        log(`- ${culto}: início ${def.inicio} / chegada ${def.chegada} (${def.recorrencia})`);
      }
      log(`- ⚠ horários provisórios, a confirmar na Etapa 3.`);
      log();

      // ---------- 6. EVENTOS (instâncias únicas) ----------
      log(`## 6. Eventos`);
      const eventosUnicos = new Map<string, SheetPresenca>();
      for (const p of sheetPresencas)
        if (!eventosUnicos.has(eventoKey(p))) eventosUnicos.set(eventoKey(p), p);
      const eventoIdPorKey = new Map<string, string>();
      for (const [key, p] of [...eventosUnicos].sort()) {
        if (!p.dataCulto) throw new Error(`Evento sem Data Culto: ${key}`);
        const tipoId = tipoIdPorCulto.get(p.culto)!;
        const def = TIPOS_DEF[p.culto];
        const descEsp = def.categoria === "evento_extra" ? p.desc || null : null;
        // Sem a unique (tipo, data): reidratação idempotente via findFirst.
        const ev =
          (await tx.evento.findFirst({
            where: { tipoEventoId: tipoId, dataEvento: p.dataCulto },
          })) ??
          (await tx.evento.create({
            data: {
              tipoEventoId: tipoId,
              dataEvento: p.dataCulto,
              horarioInicio: def.inicio,
              horarioChegadaEquipe: def.chegada,
              descricaoEspecifica: descEsp,
              status: "realizado",
              geradoAutomaticamente: false,
              criadoPor: atorId,
            },
          }));
        eventoIdPorKey.set(key, ev.id);
      }
      log(`- eventos reconstruídos: ${eventoIdPorKey.size} (esperado: 15)`);
      log();

      // ---------- 7. Deduplicação de presenças ----------
      log(`## 7. Deduplicação de presenças`);
      const grupos = new Map<string, SheetPresenca[]>(); // (evento||equipe||membro)
      for (const p of sheetPresencas) {
        const k = `${eventoKey(p)}||${p.equipe}||${normNome(p.membro)}`;
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k)!.push(p);
      }
      const mantidas: SheetPresenca[] = [];
      const removidas: { chave: string; mantida: SheetPresenca; descartadas: SheetPresenca[] }[] = [];
      for (const [k, lista] of grupos) {
        lista.sort((a, b) => {
          const ta = a.dataReg?.getTime() ?? 0;
          const tb = b.dataReg?.getTime() ?? 0;
          if (tb !== ta) return tb - ta; // mais recente primeiro
          return b.linha - a.linha; // desempate determinístico
        });
        mantidas.push(lista[0]);
        if (lista.length > 1) removidas.push({ chave: k, mantida: lista[0], descartadas: lista.slice(1) });
      }
      const totalRemovidas = removidas.reduce((s, r) => s + r.descartadas.length, 0);
      log(`- linhas lidas: ${sheetPresencas.length}`);
      log(`- registros únicos (evento, equipe, membro): ${mantidas.length} (esperado: 237)`);
      log(`- chaves com duplicata: ${removidas.length} | linhas descartadas: ${totalRemovidas}`);
      log();

      // ---------- 8. ESCALAS (derivadas: equipes que atuaram em cada evento) ----------
      log(`## 8. Escalas (derivadas da presença)`);
      const escalaSet = new Set<string>(); // eventoId||equipeId
      for (const p of mantidas) {
        const evId = eventoIdPorKey.get(eventoKey(p));
        const eqId = equipePorNome.get(p.equipe);
        if (!evId || !eqId) continue;
        escalaSet.add(`${evId}||${eqId}`);
      }
      let escalasCriadas = 0;
      for (const combo of escalaSet) {
        const [eventoId, equipeId] = combo.split("||");
        await tx.escalaEquipeEvento.upsert({
          where: { eventoId_equipeId: { eventoId, equipeId } },
          update: {},
          create: { eventoId, equipeId, tipoEscala: "regular", criadoPor: atorId },
        });
        escalasCriadas++;
      }
      log(`- escalas (evento×equipe) garantidas: ${escalasCriadas}`);
      log();

      // ---------- 9. PRESENÇAS ----------
      log(`## 9. Presenças`);
      // pré-carrega as presenças ativas já existentes para idempotência
      const eventoIds = [...eventoIdPorKey.values()];
      const existentesPresenca = await tx.presenca.findMany({
        where: { eventoId: { in: eventoIds }, excluidoEm: null },
        select: { id: true, eventoId: true, equipeId: true, membroId: true },
      });
      const chaveExistente = new Map<string, string>(); // ev||eq||me → presencaId
      for (const e of existentesPresenca)
        chaveExistente.set(`${e.eventoId}||${e.equipeId}||${e.membroId}`, e.id);

      let presInseridas = 0, presAtualizadas = 0, semMembro = 0;
      for (const p of mantidas) {
        const evId = eventoIdPorKey.get(eventoKey(p));
        const eqId = equipePorNome.get(p.equipe);
        const meId = membroIdPorNome.get(normNome(p.membro));
        if (!evId || !eqId || !meId) {
          semMembro++;
          log(`- ⚠ registro ignorado (FK não resolvida): ${p.membro} / ${p.equipe} / ${eventoKey(p)}`);
          continue;
        }
        const dados = {
          presente: p.presente,
          pontualidade: p.pontualidade,
          horarioChegada: p.horario,
          dataRegistro: p.dataReg ?? new Date(),
          registradoPor: atorId!,
        };
        const chave = `${evId}||${eqId}||${meId}`;
        const jaId = chaveExistente.get(chave);
        if (jaId) {
          await tx.presenca.update({ where: { id: jaId }, data: dados });
          presAtualizadas++;
        } else {
          await tx.presenca.create({
            data: { eventoId: evId, equipeId: eqId, membroId: meId, ...dados },
          });
          presInseridas++;
        }
      }
      log(`- inseridas: ${presInseridas} | atualizadas: ${presAtualizadas} | ignoradas: ${semMembro}`);
      log();

      // ---------- 10. Auditoria (resumo) ----------
      await tx.auditLog.create({
        data: {
          usuarioId: atorId,
          acao: "migracao_etapa2",
          tabelaAfetada: "_migracao",
          registroId: null,
          dadosNovos: {
            membrosCriados: criados,
            membrosAtualizados: atualizados,
            orfaosCriados,
            vinculosLider: vinculosCriados,
            eventos: eventoIdPorKey.size,
            presencasUnicas: mantidas.length,
            duplicatasRemovidas: totalRemovidas,
            dryRun: DRY_RUN,
          },
        },
      });

      // ---------- Relatório de duplicatas removidas ----------
      rel.push(`## Anexo — Duplicatas removidas (${totalRemovidas} linhas)`);
      rel.push(``);
      rel.push(`Regra: manteve-se o registro de maior \`Data Registro\` por (evento, equipe, membro).`);
      rel.push(``);
      if (removidas.length) {
        rel.push(`| Membro | Evento | Equipe | ×linhas | Data Registro mantida |`);
        rel.push(`|---|---|---|---|---|`);
        for (const r of removidas.sort((a, b) =>
          a.mantida.membro.localeCompare(b.mantida.membro),
        )) {
          const p = r.mantida;
          rel.push(
            `| ${p.membro} | ${p.dataCulto ? isoDate(p.dataCulto) : "?"} ${p.culto} | ${p.equipe} | ${r.descartadas.length + 1} | ${p.dataReg ? p.dataReg.toISOString() : "?"} |`,
          );
        }
      } else {
        rel.push(`_Nenhuma duplicata._`);
      }
      rel.push(``);

      // Premissas / avisos
      rel.push(`## Premissas e avisos`);
      for (const a of ASSUNCOES) rel.push(`- ${a}`);
      rel.push(`- E-mails repetidos na planilha são de quem preencheu o formulário; membros sem e-mail próprio único receberam \`slug@${DOMINIO_MEMBRO}\` (ajustável no cadastro).`);
      rel.push(`- 3 pessoas presentes na aba PRESENÇA não constam em EQUIPES → criadas como **inativas** para preservar os 237 registros (KPI "convocações").`);
      rel.push(`- Horários dos tipos de evento são provisórios (Etapa 3).`);
      rel.push(`- Escalas foram derivadas da presença real (quais equipes atuaram em cada evento).`);
      rel.push(``);
      detalheMembros.sort();

      if (DRY_RUN) {
        log(`\n>>> DRY-RUN: revertendo transação (ROLLBACK). Nada foi gravado.\n`);
        throw ROLLBACK;
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  ).catch((e) => {
    if (e === ROLLBACK) return; // dry-run concluído com sucesso
    throw e;
  });

  fs.writeFileSync(REPORT_PATH, rel.join("\n"), "utf8");
  console.log(`\n✅ ${DRY_RUN ? "Dry-run" : "Migração"} concluída. Relatório: ${REPORT_PATH}\n`);
}

main()
  .catch((e) => {
    console.error("✖ Erro na migração:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
