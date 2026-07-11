// Testes de aceite do motor de recorrência (Etapa 3).
// Rodar com: npm run test:recorrencia  (tsx scripts/test-recorrencia.ts)
// Casos exigidos pelo PDF: domingos, quartas, 1ª terça do mês (madrugada)
// e último domingo do mês (batismo), além de quinzenal e bordas de mês curto.

import {
  gerarDatas,
  calcularHorarioChegada,
  validarConfig,
  dataUTC,
  formatarDataISO,
} from "../src/lib/recorrencia";

let falhas = 0;

function verificar(nome: string, obtido: unknown, esperado: unknown) {
  const o = JSON.stringify(obtido);
  const e = JSON.stringify(esperado);
  if (o === e) {
    console.log(`  ✓ ${nome}`);
  } else {
    falhas += 1;
    console.error(`  ✗ ${nome}\n      esperado: ${e}\n      obtido:   ${o}`);
  }
}

function datas(
  tipo: Parameters<typeof gerarDatas>[0],
  config: Parameters<typeof gerarDatas>[1],
  inicio: Date,
  fim: Date,
): string[] {
  return gerarDatas(tipo, config, inicio, fim).map(formatarDataISO);
}

const jul1 = dataUTC(2026, 7, 1);
const jul31 = dataUTC(2026, 7, 31);
const set30 = dataUTC(2026, 9, 30);

console.log("Semanal");
verificar(
  "domingos de julho/2026",
  datas("semanal", { diasSemana: [0] }, jul1, jul31),
  ["2026-07-05", "2026-07-12", "2026-07-19", "2026-07-26"],
);
verificar(
  "quartas de julho/2026",
  datas("semanal", { diasSemana: [3] }, jul1, jul31),
  ["2026-07-01", "2026-07-08", "2026-07-15", "2026-07-22", "2026-07-29"],
);
verificar(
  "dom+qua juntos (contagem em 3 meses)",
  datas("semanal", { diasSemana: [0, 3] }, jul1, set30).length,
  13 + 14, // 13 domingos e 14 quartas entre 01/07 e 30/09/2026
);

console.log("Mensal por posição (1ª terça — madrugada)");
verificar(
  "1ª terça jul–set/2026",
  datas("mensal_posicao", { posicao: 1, diaSemana: 2 }, jul1, set30),
  ["2026-07-07", "2026-08-04", "2026-09-01"],
);
verificar(
  "janela que começa depois da ocorrência do mês exclui o mês",
  datas("mensal_posicao", { posicao: 1, diaSemana: 2 }, dataUTC(2026, 7, 8), set30),
  ["2026-08-04", "2026-09-01"],
);

console.log("Mensal última posição (último domingo — batismo)");
verificar(
  "último domingo jul–set/2026",
  datas("mensal_ultima_posicao", { diaSemana: 0 }, jul1, set30),
  ["2026-07-26", "2026-08-30", "2026-09-27"],
);
verificar(
  "último domingo de fevereiro/2027 (mês curto)",
  datas("mensal_ultima_posicao", { diaSemana: 0 }, dataUTC(2027, 2, 1), dataUTC(2027, 2, 28)),
  ["2027-02-28"],
);

console.log("Quinzenal");
verificar(
  "a cada 14 dias a partir de 05/07/2026",
  datas("quinzenal", { dataBase: "2026-07-05" }, jul1, set30),
  [
    "2026-07-05",
    "2026-07-19",
    "2026-08-02",
    "2026-08-16",
    "2026-08-30",
    "2026-09-13",
    "2026-09-27",
  ],
);
verificar(
  "janela começando no meio do ciclo mantém o alinhamento",
  datas("quinzenal", { dataBase: "2026-07-05" }, dataUTC(2026, 8, 1), dataUTC(2026, 8, 31)),
  ["2026-08-02", "2026-08-16", "2026-08-30"],
);

console.log("Mensal dia fixo");
verificar(
  "dia 31 vira último dia em mês curto (fev/2027 → 28)",
  datas("mensal_dia_fixo", { dia: 31 }, dataUTC(2027, 1, 1), dataUTC(2027, 3, 31)),
  ["2027-01-31", "2027-02-28", "2027-03-31"],
);

console.log("Diário e avulso");
verificar(
  "diário gera todos os dias",
  datas("diario", {}, jul1, dataUTC(2026, 7, 5)),
  ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"],
);
verificar("avulso nunca gera", datas("avulso", {}, jul1, set30), []);

console.log("Horário de chegada (início − 01:15)");
verificar("10:00 → 08:45", calcularHorarioChegada("10:00"), "08:45");
verificar("18:00 → 16:45", calcularHorarioChegada("18:00"), "16:45");
verificar("20:00 → 18:45", calcularHorarioChegada("20:00"), "18:45");
verificar("00:30 (madrugada) → 23:15 da véspera", calcularHorarioChegada("00:30"), "23:15");

console.log("Validação de config");
verificar(
  "semanal sem dias é inválido",
  validarConfig("semanal", {}) !== null,
  true,
);
verificar(
  "quinzenal sem dataBase é inválido",
  validarConfig("quinzenal", {}) !== null,
  true,
);
verificar(
  "mensal_posicao válido",
  validarConfig("mensal_posicao", { posicao: 1, diaSemana: 2 }),
  null,
);

if (falhas > 0) {
  console.error(`\n${falhas} teste(s) falharam.`);
  process.exit(1);
}
console.log("\nTodos os testes passaram.");
