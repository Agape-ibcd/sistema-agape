import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────
// Etapa 3 — Setup de infraestrutura (idempotente, pode rodar de novo):
//  1. Bucket público `fotos-membros` no Supabase Storage (fotos 300×300).
//  2. Cor padrão (cor_hex) para equipes que ainda não têm — usada nos chips
//     de escala do calendário.
//  3. config_recorrencia dos tipos de evento semanais criados na migração
//     (Domingo → dom, Quarta → qua). Só preenche quando está vazio; não
//     sobrescreve ajustes feitos depois pela tela de tipos de evento.
// ─────────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

const PALETA = ["#059669", "#0284c7", "#7c3aed", "#d97706", "#dc2626", "#0d9488"];

async function main() {
  // 1. Bucket de fotos
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes no .env");
  }
  const supabase = createClient(url, serviceKey);
  const { error: erroBucket } = await supabase.storage.createBucket("fotos-membros", {
    public: true,
    fileSizeLimit: "2MB",
    allowedMimeTypes: ["image/jpeg", "image/png"],
  });
  if (erroBucket && !/already exists/i.test(erroBucket.message)) {
    throw new Error(`Falha ao criar bucket: ${erroBucket.message}`);
  }
  console.log(
    erroBucket
      ? "Bucket fotos-membros já existia — ok."
      : "Bucket fotos-membros criado (público).",
  );

  // 2. Cores das equipes
  const equipes = await prisma.equipe.findMany({ orderBy: { dataCriacao: "asc" } });
  const emUso = new Set(equipes.map((e) => e.corHex).filter(Boolean) as string[]);
  let i = 0;
  for (const equipe of equipes) {
    if (equipe.corHex) continue;
    while (i < PALETA.length && emUso.has(PALETA[i])) i += 1;
    const cor = PALETA[i % PALETA.length];
    i += 1;
    emUso.add(cor);
    await prisma.equipe.update({ where: { id: equipe.id }, data: { corHex: cor } });
    console.log(`Cor ${cor} atribuída à equipe "${equipe.nome}".`);
  }

  // 3. config_recorrencia dos tipos semanais
  const tipos = await prisma.tipoEvento.findMany({
    where: { tipoRecorrencia: "semanal" },
  });
  for (const tipo of tipos) {
    const config = (tipo.configRecorrencia ?? {}) as { diasSemana?: number[] };
    if (Array.isArray(config.diasSemana) && config.diasSemana.length > 0) {
      console.log(`Tipo "${tipo.nome}" já configurado (${JSON.stringify(config)}) — mantido.`);
      continue;
    }
    const nome = tipo.nome.toLowerCase();
    let diasSemana: number[] | null = null;
    if (nome.includes("domingo")) diasSemana = [0];
    else if (nome.includes("segunda")) diasSemana = [1];
    else if (nome.includes("terça") || nome.includes("terca")) diasSemana = [2];
    else if (nome.includes("quarta")) diasSemana = [3];
    else if (nome.includes("quinta")) diasSemana = [4];
    else if (nome.includes("sexta")) diasSemana = [5];
    else if (nome.includes("sábado") || nome.includes("sabado")) diasSemana = [6];

    if (!diasSemana) {
      console.warn(`Tipo semanal "${tipo.nome}": dia da semana não inferido — configurar pela tela.`);
      continue;
    }
    await prisma.tipoEvento.update({
      where: { id: tipo.id },
      data: { configRecorrencia: { diasSemana } },
    });
    console.log(`Tipo "${tipo.nome}": config_recorrencia = { diasSemana: [${diasSemana}] }.`);
  }

  console.log("\nSetup da Etapa 3 concluído.");
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
