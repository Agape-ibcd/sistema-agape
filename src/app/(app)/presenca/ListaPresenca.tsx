"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useActionState,
} from "react";
import {
  salvarPresencaAuto,
  excluirPresenca,
  restaurarPresenca,
} from "./actions";
import { FeedbackModal } from "@/components/FeedbackModal";
import { PessoaHoverCard } from "@/components/PessoaHoverCard";
import { registrarChecagemPendencia } from "./pendenciaGuard";
import { registrarContagemSecao } from "./resumoFlutuanteRegistry";

// ─────────────────────────────────────────────────────────────────────────
// Lista de presença com SALVAMENTO AUTOMÁTICO: cada linha salva sozinha após
// um tempo de inatividade (toggles ~1,5s; campos de texto ~3s), com indicador
// discreto "salvando…/salvo ✓/erro" no lugar do popup padrão — decisão
// combinada com o usuário para não interromper o lançamento em sequência.
// O botão "Salvar tudo" no fim é a rede de segurança: grava na hora qualquer
// linha pendente. Exclusão/restauração continuam com confirmação + popup.
// ─────────────────────────────────────────────────────────────────────────

const DEBOUNCE_TOGGLE_MS = 1500;
const DEBOUNCE_TEXTO_MS = 3000;

// Lançamento ativo (não excluído) de um membro.
export type LancamentoAtivo = {
  id: string;
  presente: boolean;
  pontualidade: "pontual" | "atrasado" | null;
  horarioChegada: string | null;
  justificativaAusencia: string | null;
};

// Lançamento excluído (mostrado riscado, com botão restaurar).
export type LancamentoExcluido = {
  id: string;
  presente: boolean;
  pontualidade: "pontual" | "atrasado" | null;
  motivoExclusao: string | null;
};

export type MembroLinha = {
  id: string;
  nome: string;
  ativo: LancamentoAtivo | null;
  excluido: LancamentoExcluido | null;
};

type Props = {
  eventoId: string;
  equipeId: string;
  horarioChegadaSugerido: string;
  membros: MembroLinha[];
  // Nome/cor da equipe no título — a página mostra uma lista por equipe
  // escalada quando o evento tem mais de uma.
  equipeNome?: string;
  corHex?: string | null;
};

type StatusSave = "ocioso" | "pendente" | "salvando" | "salvo" | "erro";

// Situação de uma linha no momento do "Salvar tudo agora".
type EstadoLinha = {
  nome: string;
  registrado: boolean; // já tem lançamento gravado
  presente: boolean;
  excluido: boolean; // lançamento excluído de propósito
  erro: boolean; // falhou ao salvar
};

// O que cada linha expõe ao componente pai.
type ApiLinha = {
  flush: () => Promise<void>;
  estado: () => EstadoLinha;
};

type ResumoPresenca = {
  presentes: number;
  ausentes: number;
  faltando: string[];
  erros: string[];
};

export function ListaPresenca({
  eventoId,
  equipeId,
  horarioChegadaSugerido,
  membros,
  equipeNome,
  corHex,
}: Props) {
  const [estadoExcluir, excluirAction] = useActionState(excluirPresenca, null);
  const [estadoRestaurar, restaurarAction] = useActionState(
    restaurarPresenca,
    null,
  );

  // Registro de cada linha: `flush` grava o que estiver pendente e `estado`
  // devolve a situação ATUAL da linha na tela (o resumo do "Salvar tudo" não
  // pode usar os dados do servidor, que só chegam na próxima revalidação).
  const linhas = useRef(new Map<string, ApiLinha>());
  const registrarLinha = useCallback((id: string, api: ApiLinha) => {
    linhas.current.set(id, api);
    return () => {
      linhas.current.delete(id);
    };
  }, []);

  // Avisa antes de sair da página (AvisoSairPendencia) enquanto houver linha
  // sem presença/ausência lançada nesta seção — checagem sob demanda, não
  // reativa (lê `linhas.current` na hora, não força re-render da página).
  useEffect(() => {
    return registrarChecagemPendencia(`${eventoId}:${equipeId}`, () =>
      [...linhas.current.values()].some((l) => {
        const e = l.estado();
        return !e.registrado && !e.excluido;
      }),
    );
  }, [eventoId, equipeId]);

  // Contagem para o ResumoFlutuante (painel arrastável): lido por polling
  // periódico, não reativo — não vale forçar re-render da página inteira a
  // cada toggle só para um card discreto de contadores.
  useEffect(() => {
    return registrarContagemSecao(`${eventoId}:${equipeId}`, () => {
      const estados = [...linhas.current.values()].map((l) => l.estado());
      const registrados = estados.filter((e) => e.registrado);
      const presentes = registrados.filter((e) => e.presente).length;
      return {
        escalados: membros.length,
        presentes,
        ausentes: registrados.length - presentes,
      };
    });
  }, [eventoId, equipeId, membros.length]);

  const [salvandoTudo, setSalvandoTudo] = useState(false);
  const [resumo, setResumo] = useState<ResumoPresenca | null>(null);

  async function salvarTudo() {
    setSalvandoTudo(true);
    const api = [...linhas.current.values()];
    await Promise.all(api.map((l) => l.flush()));
    const estados = api.map((l) => l.estado());
    const registrados = estados.filter((e) => e.registrado);
    const presentes = registrados.filter((e) => e.presente).length;
    setSalvandoTudo(false);
    setResumo({
      presentes,
      ausentes: registrados.length - presentes,
      // Quem foi excluído de propósito não conta como "faltou registrar".
      faltando: estados.filter((e) => !e.registrado && !e.excluido).map((e) => e.nome),
      erros: estados.filter((e) => e.erro).map((e) => e.nome),
    });
  }

  const totalLancados = membros.filter((m) => m.ativo).length;

  return (
    <section className="rounded-2xl border border-edge-soft vidro-leve p-4 sm:p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold text-ink">
          {corHex !== undefined && (
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-edge-soft"
              style={{ backgroundColor: corHex ?? "#a1a1aa" }}
              aria-hidden
            />
          )}
          <span className="truncate">
            {equipeNome ? `Presença · ${equipeNome}` : "Presença da equipe"}
          </span>
        </h2>
        <span className="shrink-0 rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-medium text-ink-soft">
          {totalLancados} de {membros.length} lançados
        </span>
      </div>
      <p className="mb-2 text-xs text-ink-subtle">
        As alterações são salvas automaticamente alguns segundos após você parar
        de editar.
      </p>

      {membros.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-subtle">
          Nenhum membro ativo nesta equipe.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-edge-soft">
            {membros.map((m) => (
              <LinhaPresenca
                key={m.id}
                membro={m}
                eventoId={eventoId}
                equipeId={equipeId}
                horarioChegadaSugerido={horarioChegadaSugerido}
                registrarLinha={registrarLinha}
                excluirAction={excluirAction}
                restaurarAction={restaurarAction}
              />
            ))}
          </ul>

          {/* Rede de segurança: grava imediatamente qualquer linha pendente e
              mostra o resumo do que foi lançado. */}
          <div className="mt-3 border-t border-edge-soft pt-3">
            <button
              type="button"
              onClick={() => void salvarTudo()}
              disabled={salvandoTudo}
              className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60 sm:w-auto"
            >
              {salvandoTudo ? "Salvando…" : "Salvar tudo agora"}
            </button>
          </div>
        </>
      )}

      {resumo && (
        <CardResumo
          resumo={resumo}
          equipeNome={equipeNome}
          onFechar={() => setResumo(null)}
        />
      )}

      <FeedbackModal estado={estadoExcluir} />
      <FeedbackModal estado={estadoRestaurar} />
    </section>
  );
}

// Card de confirmação do "Salvar tudo agora": quantos presentes/ausentes e,
// se alguém ficou sem lançamento, o alerta com os nomes.
function CardResumo({
  resumo,
  equipeNome,
  onFechar,
}: {
  resumo: ResumoPresenca;
  equipeNome?: string;
  onFechar: () => void;
}) {
  const { presentes, ausentes, faltando, erros } = resumo;
  const total = presentes + ausentes;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl vidro-forte p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              erros.length > 0 ? "bg-danger-soft" : "bg-success-soft"
            }`}
            aria-hidden
          >
            {erros.length > 0 ? (
              <svg
                className="h-5 w-5 text-danger-text"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M12 8v5M12 17h.01" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5 text-success-text"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
            )}
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-ink">
              {erros.length > 0 ? "Salvo com falhas" : "Presenças salvas"}
            </h3>
            {equipeNome && (
              <p className="truncate text-xs text-ink-subtle">{equipeNome}</p>
            )}
          </div>
        </div>

        {/* Números em destaque */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-success-soft p-3 text-center">
            <p className="font-display text-3xl font-semibold leading-none text-success-text">
              {presentes}
            </p>
            <p className="mt-1 text-xs font-medium text-success-text">
              {presentes === 1 ? "presente" : "presentes"}
            </p>
          </div>
          <div className="rounded-xl bg-danger-soft p-3 text-center">
            <p className="font-display text-3xl font-semibold leading-none text-danger-text">
              {ausentes}
            </p>
            <p className="mt-1 text-xs font-medium text-danger-text">
              {ausentes === 1 ? "ausente" : "ausentes"}
            </p>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-ink-subtle">
          {total} lançamento(s) registrado(s).
        </p>

        {/* Alerta: quem ficou sem registro */}
        {faltando.length > 0 && (
          <div className="mt-4 rounded-xl bg-warn-faint p-3">
            <p className="text-sm font-semibold text-warn-text">
              Faltou registrar {faltando.length} pessoa
              {faltando.length > 1 ? "s" : ""}
            </p>
            <ul className="mt-1.5 list-inside list-disc text-xs text-warn-text">
              {faltando.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        {erros.length > 0 && (
          <div className="mt-3 rounded-xl bg-danger-faint p-3">
            <p className="text-sm font-semibold text-danger-text">
              Não foi possível salvar {erros.length} lançamento
              {erros.length > 1 ? "s" : ""}
            </p>
            <ul className="mt-1.5 list-inside list-disc text-xs text-danger-text">
              {erros.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-danger-text">
              Use “tentar de novo” na linha correspondente.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onFechar}
          className="mt-5 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Ícones dos toggles de presença/pontualidade. Simples, 18px, herdam a cor
// do botão (currentColor) — ver SegmentadoIcone abaixo para o estado
// neutro/ativo (neon) de cada um.
// ─────────────────────────────────────────────────────────────────────────

function IconeCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function IconeX() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

// Relógio com ponteiros "em ponto" (pontual).
function IconePontual() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 12V7M12 12h4" />
    </svg>
  );
}

// Mesmo relógio, mas com os ponteiros "atrasados" (posição diferente) —
// diferencia visualmente de Pontual além da cor.
function IconeAtrasado() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 12 8.7 15M12 12l3.3-1.8" />
    </svg>
  );
}

// Classes por "tom" — fundo neon (glow via shadow com a cor sólida do token)
// só quando ativo; neutro quando não selecionado.
const TOM_CLASSES = {
  success: "border-success-edge bg-success-soft text-success-text shadow-[0_0_10px_var(--success)]",
  danger: "border-danger-edge bg-danger-soft text-danger-text shadow-[0_0_10px_var(--danger)]",
  info: "border-info-edge bg-info-soft text-info-text shadow-[0_0_10px_var(--info-text)]",
  warn: "border-warn-edge bg-warn-soft text-warn-text shadow-[0_0_10px_var(--warn)]",
} as const;

// Toggle segmentado em ícones (Presente/Ausente, Pontual/Atrasado): fundo
// neon + cor do tom quando ativo, cor neutra quando nada selecionado ainda.
// `title` vira tooltip nativo do navegador.
function SegmentadoIcone<T extends string>({
  valor,
  opcoes,
  onEscolher,
}: {
  valor: T | null;
  opcoes: { valor: T; titulo: string; tom: keyof typeof TOM_CLASSES; icone: React.ReactNode }[];
  onEscolher: (v: T) => void;
}) {
  return (
    <span className="inline-flex gap-1.5">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          title={o.titulo}
          aria-label={o.titulo}
          onClick={() => onEscolher(o.valor)}
          aria-pressed={valor === o.valor}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
            valor === o.valor
              ? TOM_CLASSES[o.tom]
              : "border-edge text-ink-faint hover:bg-surface-2 hover:text-ink-soft"
          }`}
        >
          {o.icone}
        </button>
      ))}
    </span>
  );
}

function IndicadorSave({
  status,
  erro,
  aoTentarDeNovo,
}: {
  status: StatusSave;
  erro: string | null;
  aoTentarDeNovo: () => void;
}) {
  if (status === "ocioso") return null;
  if (status === "pendente")
    return <span className="text-xs text-ink-faint">alterações pendentes…</span>;
  if (status === "salvando")
    return <span className="text-xs text-ink-subtle">salvando…</span>;
  if (status === "salvo")
    return <span className="text-xs font-medium text-success-text">salvo ✓</span>;
  return (
    <button
      type="button"
      onClick={aoTentarDeNovo}
      title={erro ?? "Erro ao salvar"}
      className="text-xs font-medium text-danger-text underline underline-offset-2"
    >
      erro ao salvar — tentar de novo
    </button>
  );
}

function LinhaPresenca({
  membro,
  eventoId,
  equipeId,
  horarioChegadaSugerido,
  registrarLinha,
  excluirAction,
  restaurarAction,
}: {
  membro: MembroLinha;
  eventoId: string;
  equipeId: string;
  horarioChegadaSugerido: string;
  registrarLinha: (id: string, api: ApiLinha) => () => void;
  excluirAction: (formData: FormData) => void;
  restaurarAction: (formData: FormData) => void;
}) {
  const { ativo, excluido } = membro;

  // Estado local da linha (inicia a partir do lançamento ativo, se houver).
  const [presente, setPresente] = useState<boolean>(ativo ? ativo.presente : true);
  const [pontualidade, setPontualidade] = useState<"pontual" | "atrasado">(
    ativo?.pontualidade ?? "pontual",
  );
  const [horario, setHorario] = useState<string>(
    ativo?.horarioChegada ?? horarioChegadaSugerido,
  );
  const [justificativa, setJustificativa] = useState<string>(
    ativo?.justificativaAusencia ?? "",
  );
  const [lancamentoId, setLancamentoId] = useState<string | null>(
    ativo?.id ?? null,
  );
  const [statusSave, setStatusSave] = useState<StatusSave>("ocioso");
  const [erroSave, setErroSave] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [motivo, setMotivo] = useState("");

  // Refs para o debounce: sempre leem o estado mais atual no momento do save.
  // Sincronizadas num effect (regra do react-hooks: não escrever em ref
  // durante o render) — o timer só dispara bem depois, com o valor já fresco.
  const dadosRef = useRef({ presente, pontualidade, horario, justificativa });
  const statusRef = useRef<StatusSave>(statusSave);
  // Situação da linha lida pelo resumo do "Salvar tudo agora".
  const infoRef = useRef<EstadoLinha>({
    nome: membro.nome,
    registrado: lancamentoId !== null,
    presente,
    excluido: Boolean(excluido) && !ativo,
    erro: statusSave === "erro",
  });
  useEffect(() => {
    dadosRef.current = { presente, pontualidade, horario, justificativa };
    statusRef.current = statusSave;
    infoRef.current = {
      nome: membro.nome,
      registrado: lancamentoId !== null,
      presente,
      excluido: Boolean(excluido) && !ativo,
      erro: statusSave === "erro",
    };
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0); // descarta respostas fora de ordem

  // Sincroniza com o servidor quando o lançamento ativo muda por FORA do
  // auto-save (exclusão ou restauração revalidam a página). Padrão React de
  // "derived state" ajustado durante o render.
  const ativoId = ativo?.id ?? null;
  const [ativoIdVisto, setAtivoIdVisto] = useState(ativoId);
  if (ativoId !== ativoIdVisto) {
    setAtivoIdVisto(ativoId);
    const emEdicao = statusSave === "pendente" || statusSave === "salvando";
    if (ativoId === null) {
      // Lançamento excluído no servidor → volta a linha ao estado inicial.
      if (!emEdicao) {
        setLancamentoId(null);
        setStatusSave("ocioso");
        setExcluindo(false);
        setMotivo("");
      }
    } else {
      setLancamentoId(ativoId);
      if (!emEdicao && ativo) {
        // Restauração (ou criação vinda de outro lugar): adota os valores.
        setPresente(ativo.presente);
        setPontualidade(ativo.pontualidade ?? "pontual");
        setHorario(ativo.horarioChegada ?? horarioChegadaSugerido);
        setJustificativa(ativo.justificativaAusencia ?? "");
        setExcluindo(false);
      }
    }
  }

  const salvarAgora = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const seq = ++seqRef.current;
    setStatusSave("salvando");
    const d = dadosRef.current;
    const r = await salvarPresencaAuto({
      eventoId,
      equipeId,
      membroId: membro.id,
      presente: d.presente,
      pontualidade: d.pontualidade,
      horarioChegada: d.presente ? d.horario : "",
      justificativa: d.presente ? "" : d.justificativa,
    });
    if (seq !== seqRef.current) return; // houve alteração mais nova
    if (r.ok) {
      setLancamentoId(r.presencaId);
      setStatusSave("salvo");
      setErroSave(null);
      // Atualiza JÁ (sem esperar o re-render): o resumo do "Salvar tudo" lê
      // este ref logo depois do await.
      infoRef.current = {
        ...infoRef.current,
        registrado: true,
        presente: d.presente,
        excluido: false,
        erro: false,
      };
    } else {
      setStatusSave("erro");
      setErroSave(r.message);
      infoRef.current = { ...infoRef.current, erro: true };
    }
  }, [eventoId, equipeId, membro.id]);

  const agendarSave = useCallback(
    (ms: number) => {
      seqRef.current += 1; // invalida resposta de save em andamento
      setStatusSave("pendente");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void salvarAgora(), ms);
    },
    [salvarAgora],
  );

  // "Salvar tudo": grava se houver alteração pendente ou erro a repetir, e
  // expõe a situação da linha para o card de resumo.
  useEffect(() => {
    return registrarLinha(membro.id, {
      flush: async () => {
        if (statusRef.current === "pendente" || statusRef.current === "erro") {
          await salvarAgora();
        }
      },
      estado: () => infoRef.current,
    });
  }, [membro.id, registrarLinha, salvarAgora]);

  // Limpa o timer ao desmontar (troca de evento/página).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const inputCls =
    "rounded-lg border border-edge px-2.5 py-1.5 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring";

  // Lançamento excluído (e sem lançamento ativo): mostra riscado + restaurar.
  if (excluido && !ativo && statusSave === "ocioso") {
    return (
      <li className="py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <PessoaHoverCard membroId={membro.id}>
              <p className="truncate text-sm font-medium text-ink-subtle line-through">
                {membro.nome}
              </p>
            </PessoaHoverCard>
            <p className="text-xs text-danger-text">
              Excluído
              {excluido.motivoExclusao ? ` · ${excluido.motivoExclusao}` : ""}
            </p>
          </div>
          <form
            action={restaurarAction}
            onSubmit={(ev) => {
              if (!window.confirm(`Restaurar o lançamento de ${membro.nome}?`))
                ev.preventDefault();
            }}
          >
            <input type="hidden" name="presencaId" value={excluido.id} />
            <button
              type="submit"
              className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-brand-edge hover:bg-brand-faint hover:text-brand-text"
            >
              Restaurar
            </button>
          </form>
        </div>
      </li>
    );
  }

  const naoLancado = !lancamentoId && statusSave === "ocioso";
  // Nome fica na cor da situação registrada — neutro enquanto não há lançamento.
  const corNome = naoLancado
    ? "text-ink"
    : presente
      ? "text-success-text"
      : "text-danger-text";

  return (
    <li className="py-2.5">
      <div className="flex items-center justify-between gap-2">
        <PessoaHoverCard membroId={membro.id}>
          <p className={`min-w-0 truncate text-sm font-medium ${corNome}`}>
            {membro.nome}
          </p>
        </PessoaHoverCard>
        <span className="shrink-0">
          {naoLancado ? (
            <span className="text-xs text-ink-faint">não lançado</span>
          ) : (
            <IndicadorSave
              status={statusSave}
              erro={erroSave}
              aoTentarDeNovo={() => void salvarAgora()}
            />
          )}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <SegmentadoIcone
          valor={naoLancado ? null : presente ? "sim" : "nao"}
          opcoes={[
            { valor: "sim", titulo: "Presente", tom: "success", icone: <IconeCheck /> },
            { valor: "nao", titulo: "Ausente", tom: "danger", icone: <IconeX /> },
          ]}
          onEscolher={(v) => {
            setPresente(v === "sim");
            agendarSave(DEBOUNCE_TOGGLE_MS);
          }}
        />

        {naoLancado ? null : presente ? (
          <>
            <SegmentadoIcone
              valor={pontualidade}
              opcoes={[
                { valor: "pontual", titulo: "Pontual", tom: "info", icone: <IconePontual /> },
                { valor: "atrasado", titulo: "Atrasado", tom: "warn", icone: <IconeAtrasado /> },
              ]}
              onEscolher={(v) => {
                setPontualidade(v);
                agendarSave(DEBOUNCE_TOGGLE_MS);
              }}
            />
            <input
              type="time"
              value={horario}
              onChange={(e) => {
                setHorario(e.target.value);
                agendarSave(DEBOUNCE_TEXTO_MS);
              }}
              aria-label="Horário de chegada"
              className={`${inputCls} w-24`}
            />
          </>
        ) : (
          <input
            value={justificativa}
            onChange={(e) => {
              setJustificativa(e.target.value);
              agendarSave(DEBOUNCE_TEXTO_MS);
            }}
            maxLength={500}
            placeholder="Justificativa (opcional)"
            className={`${inputCls} min-w-40 flex-1`}
          />
        )}

        {lancamentoId && !excluindo && (
          <button
            type="button"
            onClick={() => setExcluindo(true)}
            className="ml-auto text-xs font-medium text-ink-faint underline-offset-2 hover:text-danger-text hover:underline"
          >
            Excluir
          </button>
        )}
      </div>

      {/* Exclusão: motivo obrigatório + confirmação nativa antes de enviar. */}
      {lancamentoId && excluindo && (
        <form
          action={excluirAction}
          onSubmit={(ev) => {
            if (
              !window.confirm(
                `Excluir o lançamento de ${membro.nome}? Ele poderá ser restaurado depois.`,
              )
            )
              ev.preventDefault();
          }}
          className="mt-2 space-y-2 rounded-lg bg-danger-faint p-3"
        >
          <input type="hidden" name="presencaId" value={lancamentoId} />
          <input
            name="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            required
            maxLength={500}
            placeholder="Motivo da exclusão (obrigatório)"
            className={`${inputCls} w-full`}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={motivo.trim().length === 0}
              className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger-strong disabled:opacity-60"
            >
              Confirmar exclusão
            </button>
            <button
              type="button"
              onClick={() => {
                setExcluindo(false);
                setMotivo("");
              }}
              className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-surface-2"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
