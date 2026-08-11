import "server-only";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────
// Aniversariantes (Etapa 5). Regras: mês corrente, destaque do dia, badge D-3,
// idade e foto. Datas de nascimento em @db.Date (UTC meia-noite) — extraímos
// dia/mês/ano em UTC. O "hoje" é o de São Paulo (fuso dos usuários).
// ─────────────────────────────────────────────────────────────────────────

export type HojeBR = { ano: number; mes: number; dia: number };

export function hojeSaoPaulo(): HojeBR {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [ano, mes, dia] = fmt.format(new Date()).split("-").map(Number);
  return { ano, mes, dia };
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function nomeMes(mes: number): string {
  return MESES[mes - 1] ?? "";
}

export type Aniversariante = {
  id: string;
  nome: string;
  fotoUrl: string | null;
  equipeId: string | null;
  equipeNome: string | null;
  dia: number;
  mes: number;
  dataBR: string; // dd/mm
  idadeQueCompleta: number | null; // null se ano de nascimento desconhecido
  diasAte: number; // negativo = já passou no mês; 0 = hoje; >0 = futuro
  ehHoje: boolean;
  proximoD3: boolean; // 1..3 dias à frente
};

// Carrega os aniversariantes de um mês (padrão: mês corrente de São Paulo),
// ordenados por dia. `equipeId` opcional restringe a uma equipe.
export async function aniversariantesDoMes(
  hoje: HojeBR,
  mes = hoje.mes,
  equipeId?: string | null,
): Promise<Aniversariante[]> {
  const membros = await prisma.membro.findMany({
    where: {
      // Afastados (temporários) seguem no painel; só inativos saem.
      status: { not: "inativo" },
      dataNascimento: { not: null },
      ...(equipeId ? { equipeId } : {}),
    },
    select: {
      id: true,
      nomeCompleto: true,
      fotoUrl: true,
      dataNascimento: true,
      equipeId: true,
      equipe: { select: { nome: true } },
    },
  });

  const doMes = membros.filter(
    (m) => m.dataNascimento && m.dataNascimento.getUTCMonth() + 1 === mes,
  );

  const lista: Aniversariante[] = doMes.map((m) => {
    const nasc = m.dataNascimento!;
    const dia = nasc.getUTCDate();
    const anoNasc = nasc.getUTCFullYear();
    // Ano de nascimento "1900" é sentinela de "desconhecido" em alguns cadastros.
    const idadeQueCompleta =
      anoNasc > 1900 ? hoje.ano - anoNasc : null;
    const diasAte = mes === hoje.mes ? dia - hoje.dia : dia - hoje.dia; // mesmo mês
    const ehHoje = mes === hoje.mes && diasAte === 0;
    const proximoD3 = mes === hoje.mes && diasAte >= 1 && diasAte <= 3;

    return {
      id: m.id,
      nome: m.nomeCompleto,
      fotoUrl: m.fotoUrl,
      equipeId: m.equipeId,
      equipeNome: m.equipe?.nome ?? null,
      dia,
      mes,
      dataBR: `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`,
      idadeQueCompleta,
      diasAte,
      ehHoje,
      proximoD3,
    };
  });

  return lista.sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome));
}
