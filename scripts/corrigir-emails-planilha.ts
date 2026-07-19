import "dotenv/config";
import ExcelJS from "exceljs";
import path from "node:path";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────
// Sessão 3 (revisão UX/dados) — corrige o e-mail dos membros JÁ CADASTRADOS
// de acordo com a planilha `Presença_Ágape.xlsx` (mesma fonte da migração
// da Etapa 2, mesma regra de nome normalizado / e-mail confiável).
//
// NÃO cria nem altera nada de quem não está na planilha (membros novos como
// o casal registrado depois da migração ficam exatamente como estão).
// Só corrige quando a planilha tem um e-mail confiável (aparece uma única
// vez nela) diferente do e-mail atual do membro no sistema.
//
// Quando o membro tem login (authUserId), o e-mail também é sincronizado no
// Supabase Auth — senão a pessoa continuaria entrando com o e-mail antigo
// enquanto o cadastro mostraria o novo (dessincroniza login e cadastro).
//
// Uso:
//   npx tsx scripts/corrigir-emails-planilha.ts --dry-run   # só relatório
//   npx tsx scripts/corrigir-emails-planilha.ts             # grava de verdade
// ─────────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");
const XLSX_PATH = path.resolve(process.cwd(), "Presença_Ágape.xlsx");
const REPORT_PATH = path.resolve(process.cwd(), "RELATORIO-CORRECAO-EMAILS.md");

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

function authAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  ).auth.admin;
}

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

// Mesma normalização usada na migração original (Etapa 2) — sem isso o
// casamento por nome não bate com os membros já cadastrados.
function normNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

type SheetMembro = { email: string; nome: string };

async function lerPlanilha(): Promise<SheetMembro[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const eq = wb.getWorksheet("EQUIPES");
  if (!eq) throw new Error("Aba EQUIPES não encontrada na planilha.");

  const membros: SheetMembro[] = [];
  for (let r = 2; r <= eq.rowCount; r++) {
    const row = eq.getRow(r);
    const nome = cellText(row.getCell(4).value);
    if (!nome) continue;
    membros.push({ email: cellText(row.getCell(2).value).toLowerCase(), nome });
  }
  return membros;
}

async function main() {
  console.log(`\n=== Correção de e-mails via planilha ${DRY_RUN ? "(DRY-RUN)" : "(GRAVAÇÃO REAL)"} ===\n`);

  const sheetMembros = await lerPlanilha();

  // Mesma regra da migração: e-mail só é confiável se aparecer 1x na planilha
  // (repetidos são de quem preencheu o formulário em nome de outros).
  const emailCount = new Map<string, number>();
  for (const m of sheetMembros) if (m.email) emailCount.set(m.email, (emailCount.get(m.email) ?? 0) + 1);

  const membrosDb = await prisma.membro.findMany({
    select: { id: true, nomeCompleto: true, email: true, authUserId: true },
  });
  const dbPorNome = new Map(membrosDb.map((m) => [normNome(m.nomeCompleto), m]));
  const dbPorEmail = new Set(membrosDb.map((m) => m.email.toLowerCase()));

  const rel: string[] = [];
  const log = (l = "") => {
    console.log(l);
    rel.push(l);
  };
  log(`# Relatório — correção de e-mails via planilha`);
  log(``);
  log(`- Modo: ${DRY_RUN ? "DRY-RUN (nada gravado)" : "GRAVAÇÃO REAL"}`);
  log(`- Data: ${new Date().toISOString()}`);
  log(``);

  const correcoes: { nome: string; de: string; para: string; membroId: string; authUserId: string | null }[] = [];
  const semMudanca: string[] = [];
  const naoEncontrados: string[] = [];
  const emailNaoConfiavel: string[] = [];
  const colisoes: string[] = [];

  for (const sm of sheetMembros) {
    const key = normNome(sm.nome);
    const membro = dbPorNome.get(key);
    if (!membro) {
      naoEncontrados.push(sm.nome);
      continue;
    }

    const emailConfiavel = sm.email && emailCount.get(sm.email) === 1;
    if (!emailConfiavel) {
      if (sm.email) emailNaoConfiavel.push(`${sm.nome} (e-mail repetido na planilha: ${sm.email})`);
      continue;
    }

    if (sm.email === membro.email.toLowerCase()) {
      semMudanca.push(sm.nome);
      continue;
    }

    // Evita colidir com o e-mail de OUTRO membro já cadastrado.
    if (dbPorEmail.has(sm.email) && membro.email.toLowerCase() !== sm.email) {
      colisoes.push(`${sm.nome}: e-mail da planilha (${sm.email}) já pertence a outro membro no sistema.`);
      continue;
    }

    correcoes.push({
      nome: sm.nome,
      de: membro.email,
      para: sm.email,
      membroId: membro.id,
      authUserId: membro.authUserId,
    });
  }

  log(`## Resumo`);
  log(`- Membros na planilha: ${sheetMembros.length}`);
  log(`- Correções propostas: ${correcoes.length}`);
  log(`- Já corretos (sem mudança): ${semMudanca.length}`);
  log(`- Não encontrados no sistema (planilha desatualizada ou nome diferente): ${naoEncontrados.length}`);
  log(`- E-mail da planilha não confiável (repetido/vazio): ${emailNaoConfiavel.length}`);
  log(`- Colisões (e-mail já usado por outro membro): ${colisoes.length}`);
  log(``);

  log(`## Correções propostas`);
  if (correcoes.length === 0) {
    log(`_Nenhuma._`);
  } else {
    log(`| Nome | E-mail atual | E-mail correto (planilha) | Tem login? |`);
    log(`|---|---|---|---|`);
    for (const c of correcoes) {
      log(`| ${c.nome} | ${c.de} | ${c.para} | ${c.authUserId ? "sim" : "não"} |`);
    }
  }
  log(``);

  if (naoEncontrados.length > 0) {
    log(`## Não encontrados no sistema`);
    for (const n of naoEncontrados) log(`- ${n}`);
    log(``);
  }
  if (colisoes.length > 0) {
    log(`## Colisões (não corrigidas — revisar manualmente)`);
    for (const c of colisoes) log(`- ${c}`);
    log(``);
  }

  fs.writeFileSync(REPORT_PATH, rel.join("\n"), "utf8");
  console.log(`\nRelatório salvo em: ${REPORT_PATH}`);

  if (DRY_RUN) {
    console.log(`\nDRY-RUN: nada foi gravado. Rode sem --dry-run para aplicar.\n`);
    return;
  }

  if (correcoes.length === 0) {
    console.log(`\nNada a corrigir.\n`);
    return;
  }

  console.log(`\nAplicando ${correcoes.length} correção(ões)...\n`);
  let ok = 0;
  const falhas: string[] = [];

  for (const c of correcoes) {
    try {
      if (c.authUserId) {
        const { error } = await authAdmin().updateUserById(c.authUserId, { email: c.para });
        if (error) {
          falhas.push(`${c.nome}: falha ao atualizar login no Supabase Auth — ${error.message}`);
          continue;
        }
      }
      const antes = c.de;
      await prisma.membro.update({ where: { id: c.membroId }, data: { email: c.para } });
      await prisma.auditLog.create({
        data: {
          acao: "corrigir_email_planilha",
          tabelaAfetada: "membros",
          registroId: c.membroId,
          dadosAnteriores: { email: antes },
          dadosNovos: { email: c.para },
        },
      });
      ok++;
      console.log(`✓ ${c.nome}: ${c.de} → ${c.para}`);
    } catch (erro) {
      falhas.push(`${c.nome}: ${erro instanceof Error ? erro.message : "falha desconhecida"}`);
    }
  }

  console.log(`\nConcluído: ${ok} corrigido(s), ${falhas.length} falha(s).`);
  if (falhas.length > 0) {
    console.log(`\nFalhas:`);
    for (const f of falhas) console.log(`- ${f}`);
  }
}

main()
  .catch((erro) => {
    console.error("Erro:", erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
