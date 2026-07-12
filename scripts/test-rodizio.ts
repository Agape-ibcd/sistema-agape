// Testes de aceite do motor de rodízio de escalas.
// Rodar com: npm run test:rodizio  (tsx scripts/test-rodizio.ts)
// Cenário real: ciclo quinzenal ancorado na semana de 12/07/2026 —
//   semana 0 (12/07): manhã = José Maria/Guilherme · noite = Geisa/Ednei
//   semana 1 (19/07): manhã = Clayton & Janaína   · noite = Fernando & Evânia

import { dataUTC, formatarDataISO } from "../src/lib/recorrencia";
import {
  domingoDaSemana,
  indiceCiclo,
  equipesDesejadas,
  planejarRodizio,
  previaSemanas,
  validarCicloRodizio,
  type ConfigRodizio,
  type EventoParaRodizio,
} from "../src/lib/rodizio";

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

// Equipes (ids curtos para leitura dos testes)
const JOSE = "eq-jose-manha";
const CLAYTON = "eq-clayton-manha";
const GEISA = "eq-geisa-noite";
const FERNANDO = "eq-fernando-noite";

const ANCORA = dataUTC(2026, 7, 12); // domingo 12/07/2026
const CONFIG: ConfigRodizio = {
  semanaAncora: ANCORA,
  ciclo: [
    { manha: JOSE, noite: GEISA }, // semana 0 (12/07, 26/07, 09/08…)
    { manha: CLAYTON, noite: FERNANDO }, // semana 1 (19/07, 02/08…)
  ],
};

console.log("Semana e índice do ciclo");
verificar(
  "domingo da semana de sábado 18/07",
  formatarDataISO(domingoDaSemana(dataUTC(2026, 7, 18))),
  "2026-07-12",
);
verificar("12/07 → índice 0", indiceCiclo(dataUTC(2026, 7, 12), ANCORA, 2), 0);
verificar("15/07 (qua) → índice 0", indiceCiclo(dataUTC(2026, 7, 15), ANCORA, 2), 0);
verificar("19/07 → índice 1", indiceCiclo(dataUTC(2026, 7, 19), ANCORA, 2), 1);
verificar("26/07 → índice 0", indiceCiclo(dataUTC(2026, 7, 26), ANCORA, 2), 0);
verificar("02/08 → índice 1", indiceCiclo(dataUTC(2026, 8, 2), ANCORA, 2), 1);
verificar(
  "semana ANTERIOR à âncora (05/07) → índice 1 (módulo não-negativo)",
  indiceCiclo(dataUTC(2026, 7, 5), ANCORA, 2),
  1,
);
verificar(
  "ciclo de 1 semana → sempre índice 0",
  indiceCiclo(dataUTC(2026, 8, 30), ANCORA, 1),
  0,
);

console.log("Equipes desejadas por evento");
const entrada0 = CONFIG.ciclo[0];
verificar(
  "domingo 10:00 → só equipe da manhã (regular)",
  equipesDesejadas({ dataEvento: dataUTC(2026, 7, 12), horarioInicio: "10:00" }, entrada0),
  [{ equipeId: JOSE, tipoEscala: "regular" }],
);
verificar(
  "domingo 18:00 → só equipe da noite (regular)",
  equipesDesejadas({ dataEvento: dataUTC(2026, 7, 12), horarioInicio: "18:00" }, entrada0),
  [{ equipeId: GEISA, tipoEscala: "regular" }],
);
verificar(
  "domingo 15:59 → manhã (borda do corte 16h)",
  equipesDesejadas({ dataEvento: dataUTC(2026, 7, 12), horarioInicio: "15:59" }, entrada0),
  [{ equipeId: JOSE, tipoEscala: "regular" }],
);
verificar(
  "domingo 16:00 → noite (borda do corte 16h)",
  equipesDesejadas({ dataEvento: dataUTC(2026, 7, 12), horarioInicio: "16:00" }, entrada0),
  [{ equipeId: GEISA, tipoEscala: "regular" }],
);
verificar(
  "quarta 20:00 → as duas equipes (cobertura)",
  equipesDesejadas({ dataEvento: dataUTC(2026, 7, 15), horarioInicio: "20:00" }, entrada0),
  [
    { equipeId: JOSE, tipoEscala: "cobertura" },
    { equipeId: GEISA, tipoEscala: "cobertura" },
  ],
);
verificar(
  "sexta avulso 19:30 → as duas equipes (cobertura)",
  equipesDesejadas({ dataEvento: dataUTC(2026, 7, 17), horarioInicio: "19:30" }, entrada0),
  [
    { equipeId: JOSE, tipoEscala: "cobertura" },
    { equipeId: GEISA, tipoEscala: "cobertura" },
  ],
);
verificar(
  "mesma equipe nos dois turnos → sem duplicata no meio de semana",
  equipesDesejadas(
    { dataEvento: dataUTC(2026, 7, 15), horarioInicio: "20:00" },
    { manha: JOSE, noite: JOSE },
  ),
  [{ equipeId: JOSE, tipoEscala: "cobertura" }],
);

console.log("Planejamento (idempotência e proteções)");

function evento(
  id: string,
  dia: Date,
  horario: string,
  escalas: EventoParaRodizio["escalas"] = [],
  status: EventoParaRodizio["status"] = "agendado",
): EventoParaRodizio {
  return { id, rotulo: id, dataEvento: dia, horarioInicio: horario, status, escalas };
}

// Semana 19/07 vazia → preenche com a dupla 1 (Clayton + Fernando).
const planoVazio = planejarRodizio(CONFIG, [
  evento("dom-manha-19", dataUTC(2026, 7, 19), "10:00"),
  evento("dom-noite-19", dataUTC(2026, 7, 19), "18:00"),
  evento("qua-22", dataUTC(2026, 7, 22), "20:00"),
]);
verificar(
  "semana 19/07 vazia → 4 escalas criadas na dupla certa",
  planoVazio.criar,
  [
    { eventoId: "dom-manha-19", equipeId: CLAYTON, tipoEscala: "regular" },
    { eventoId: "dom-noite-19", equipeId: FERNANDO, tipoEscala: "regular" },
    { eventoId: "qua-22", equipeId: CLAYTON, tipoEscala: "cobertura" },
    { eventoId: "qua-22", equipeId: FERNANDO, tipoEscala: "cobertura" },
  ],
);
verificar("… 3 eventos alterados, nada removido", [
  planoVazio.eventosAlterados,
  planoVazio.removerEscalaIds.length,
], [3, 0]);

// Evento com escala manual → personalizado, intocado.
const planoManual = planejarRodizio(CONFIG, [
  evento("conf-1", dataUTC(2026, 7, 21), "19:30", [
    { id: "esc-m1", equipeId: GEISA, origem: "manual", temPresenca: false },
  ]),
]);
verificar(
  "evento com escala manual → pulado (nada criado/removido)",
  [planoManual.criar.length, planoManual.removerEscalaIds.length, planoManual.eventosPersonalizados],
  [0, 0, 1],
);

// Já aplicado corretamente → idempotente.
const planoIdem = planejarRodizio(CONFIG, [
  evento("dom-manha-19", dataUTC(2026, 7, 19), "10:00", [
    { id: "esc-r1", equipeId: CLAYTON, origem: "rodizio", temPresenca: false },
  ]),
  evento("qua-22", dataUTC(2026, 7, 22), "20:00", [
    { id: "esc-r2", equipeId: CLAYTON, origem: "rodizio", temPresenca: false },
    { id: "esc-r3", equipeId: FERNANDO, origem: "rodizio", temPresenca: false },
  ]),
]);
verificar(
  "reaplicação sem mudanças → 0 ações, 2 eventos já corretos",
  [planoIdem.criar.length, planoIdem.removerEscalaIds.length, planoIdem.eventosJaCorretos],
  [0, 0, 2],
);

// Ciclo editado (duplas trocadas) → corrige escalas de rodízio sem presença.
const planoCorrige = planejarRodizio(CONFIG, [
  evento("dom-manha-19", dataUTC(2026, 7, 19), "10:00", [
    { id: "esc-errada", equipeId: JOSE, origem: "rodizio", temPresenca: false },
  ]),
]);
verificar(
  "escala de rodízio desatualizada e sem presença → troca (remove + cria)",
  [planoCorrige.removerEscalaIds, planoCorrige.criar],
  [["esc-errada"], [{ eventoId: "dom-manha-19", equipeId: CLAYTON, tipoEscala: "regular" }]],
);

// Escala de rodízio desatualizada COM presença → mantém com aviso.
const planoPresenca = planejarRodizio(CONFIG, [
  evento("dom-manha-19", dataUTC(2026, 7, 19), "10:00", [
    { id: "esc-com-presenca", equipeId: JOSE, origem: "rodizio", temPresenca: true },
  ]),
]);
verificar(
  "desatualizada com presença → não remove, cria a certa e avisa",
  [
    planoPresenca.removerEscalaIds.length,
    planoPresenca.criar.length,
    planoPresenca.avisos.length,
  ],
  [0, 1, 1],
);

// Cancelado/realizado → fora de escopo.
const planoStatus = planejarRodizio(CONFIG, [
  evento("cancelado-1", dataUTC(2026, 7, 19), "10:00", [], "cancelado"),
  evento("realizado-1", dataUTC(2026, 7, 12), "10:00", [], "realizado"),
]);
verificar(
  "cancelado e realizado → ignorados",
  [planoStatus.criar.length, planoStatus.eventosForaDeEscopo],
  [0, 2],
);

console.log("Prévia e validação");
const previa = previaSemanas(CONFIG, dataUTC(2026, 7, 12), 4);
verificar(
  "prévia de 4 semanas alterna 0,1,0,1",
  previa.map((p) => [formatarDataISO(p.domingo), p.indice]),
  [
    ["2026-07-12", 0],
    ["2026-07-19", 1],
    ["2026-07-26", 0],
    ["2026-08-02", 1],
  ],
);
const equipesValidas = new Set([JOSE, CLAYTON, GEISA, FERNANDO]);
verificar("ciclo válido → sem erro", validarCicloRodizio(CONFIG.ciclo, equipesValidas), null);
verificar(
  "ciclo vazio → erro",
  validarCicloRodizio([], equipesValidas) !== null,
  true,
);
verificar(
  "equipe inexistente → erro na semana certa",
  validarCicloRodizio([{ manha: "x", noite: GEISA }], equipesValidas),
  "Semana 1 do ciclo: selecione a equipe da manhã.",
);

console.log(falhas === 0 ? "\nTodos os testes passaram ✔" : `\n${falhas} teste(s) falharam ✖`);
process.exit(falhas === 0 ? 0 : 1);
