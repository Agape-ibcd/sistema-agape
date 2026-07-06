import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";
import type { NivelAcesso, TurnoEquipe } from "../src/generated/prisma/enums";

// ─────────────────────────────────────────────────────────────────────────
// Seed da Etapa 1 — Fundação.
// Cria as 4 equipes reais e 4 contas de login (uma por nível de acesso),
// vinculando cada uma ao Supabase Auth + tabela MEMBROS. Idempotente.
//
// NÃO é a migração de dados (Etapa 2) — aqui só semeamos o mínimo para testar
// login, RBAC e gravação. Rode com:  npm run seed
// ─────────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SENHA_PADRAO = process.env.SEED_SENHA ?? "Agape@2026";

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error(
    "Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env",
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EQUIPES: { nome: string; turno: TurnoEquipe; cor: string }[] = [
  { nome: "Clayton & Janaína (Manhã)", turno: "manha", cor: "#2563eb" },
  { nome: "José Maria & Neusa | Guilherme & Thaís (Manhã)", turno: "manha", cor: "#16a34a" },
  { nome: "Geisa e Bell | Ednei & Darcilene (Noite)", turno: "noite", cor: "#9333ea" },
  { nome: "Fernando & Evânia (Noite)", turno: "noite", cor: "#dc2626" },
];

type SeedUsuario = {
  email: string;
  nome: string;
  nivel: NivelAcesso;
  equipeNome: string | null;
};

const USUARIOS: SeedUsuario[] = [
  {
    email: "gestor@lebrai.com.br",
    nome: "Erickson Alexandre Crespim",
    nivel: "super_admin",
    equipeNome: null,
  },
  {
    email: "admin@agape.local",
    nome: "Administrador Ágape",
    nivel: "admin",
    equipeNome: null,
  },
  {
    email: "lider@agape.local",
    nome: "Clayton de Moraes Alves Silva",
    nivel: "lider",
    equipeNome: "Clayton & Janaína (Manhã)",
  },
  {
    email: "membro@agape.local",
    nome: "Membro Teste",
    nivel: "membro",
    equipeNome: "Clayton & Janaína (Manhã)",
  },
];

// Garante um usuário de Auth existente para o e-mail; devolve o id.
async function garantirAuthUser(email: string): Promise<string> {
  // Procura entre os usuários já existentes (paginado).
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const achado = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (achado) return achado.id;
    if (data.users.length < 200) break; // última página
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SENHA_PADRAO,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  console.log("→ Semeando equipes…");
  const equipesPorNome = new Map<string, string>();
  for (const eq of EQUIPES) {
    const existente = await prisma.equipe.findFirst({ where: { nome: eq.nome } });
    const registro = existente
      ? await prisma.equipe.update({
          where: { id: existente.id },
          data: { turnoPadrao: eq.turno, corHex: eq.cor },
        })
      : await prisma.equipe.create({
          data: { nome: eq.nome, turnoPadrao: eq.turno, corHex: eq.cor },
        });
    equipesPorNome.set(eq.nome, registro.id);
  }
  console.log(`  ✓ ${EQUIPES.length} equipes prontas.`);

  console.log("→ Semeando usuários (Auth + MEMBROS)…");
  for (const u of USUARIOS) {
    const authUserId = await garantirAuthUser(u.email);
    const equipeId = u.equipeNome ? equipesPorNome.get(u.equipeNome) ?? null : null;

    await prisma.membro.upsert({
      where: { email: u.email },
      update: {
        authUserId,
        nomeCompleto: u.nome,
        nivelAcesso: u.nivel,
        equipeId,
        status: "ativo",
      },
      create: {
        email: u.email,
        authUserId,
        nomeCompleto: u.nome,
        nivelAcesso: u.nivel,
        equipeId,
        status: "ativo",
      },
    });
    console.log(`  ✓ ${u.nivel.padEnd(11)} ${u.email}`);
  }

  console.log("\n✅ Seed concluído.");
  console.log(`   Senha padrão de todas as contas de teste: ${SENHA_PADRAO}`);
  console.log("   (Troque a senha em produção.)");
}

main()
  .catch((e) => {
    console.error("✖ Erro no seed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
