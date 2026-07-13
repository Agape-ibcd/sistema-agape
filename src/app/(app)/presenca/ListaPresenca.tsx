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
};

type StatusSave = "ocioso" | "pendente" | "salvando" | "salvo" | "erro";

export function ListaPresenca({
  eventoId,
  equipeId,
  horarioChegadaSugerido,
  membros,
}: Props) {
  const [estadoExcluir, excluirAction] = useActionState(excluirPresenca, null);
  const [estadoRestaurar, restaurarAction] = useActionState(
    restaurarPresenca,
    null,
  );

  // Registro das funções de "salvar agora" de cada linha (p/ Salvar tudo).
  const flushes = useRef(new Map<string, () => void>());
  const registrarFlush = useCallback((id: string, fn: () => void) => {
    flushes.current.set(id, fn);
    return () => {
      flushes.current.delete(id);
    };
  }, []);

  const totalLancados = membros.filter((m) => m.ativo).length;

  return (
    <section className="rounded-2xl border border-edge-soft bg-surface p-4 sm:p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Presença da equipe</h2>
        <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-medium text-ink-soft">
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
                registrarFlush={registrarFlush}
                excluirAction={excluirAction}
                restaurarAction={restaurarAction}
              />
            ))}
          </ul>

          {/* Rede de segurança: grava imediatamente qualquer linha pendente. */}
          <div className="mt-3 border-t border-edge-soft pt-3">
            <button
              type="button"
              onClick={() => flushes.current.forEach((fn) => fn())}
              className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong sm:w-auto"
            >
              Salvar tudo agora
            </button>
          </div>
        </>
      )}

      <FeedbackModal estado={estadoExcluir} />
      <FeedbackModal estado={estadoRestaurar} />
    </section>
  );
}

// Toggle segmentado compacto (Presente/Ausente, Pontual/Atrasado).
function Segmentado<T extends string>({
  valor,
  opcoes,
  onEscolher,
}: {
  valor: T | null;
  opcoes: { valor: T; rotulo: string; corAtiva: string }[];
  onEscolher: (v: T) => void;
}) {
  return (
    <span className="inline-flex overflow-hidden rounded-lg border border-edge">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onEscolher(o.valor)}
          aria-pressed={valor === o.valor}
          className={`px-2.5 py-1.5 text-xs font-medium transition ${
            valor === o.valor
              ? o.corAtiva
              : "bg-surface text-ink-soft hover:bg-surface-2"
          }`}
        >
          {o.rotulo}
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
    return <span className="text-xs font-medium text-brand-text">salvo ✓</span>;
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
  registrarFlush,
  excluirAction,
  restaurarAction,
}: {
  membro: MembroLinha;
  eventoId: string;
  equipeId: string;
  horarioChegadaSugerido: string;
  registrarFlush: (id: string, fn: () => void) => () => void;
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
  useEffect(() => {
    dadosRef.current = { presente, pontualidade, horario, justificativa };
    statusRef.current = statusSave;
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
    } else {
      setStatusSave("erro");
      setErroSave(r.message);
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

  // "Salvar tudo": só age se houver alteração pendente ou erro a repetir.
  useEffect(() => {
    return registrarFlush(membro.id, () => {
      if (statusRef.current === "pendente" || statusRef.current === "erro") {
        void salvarAgora();
      }
    });
  }, [membro.id, registrarFlush, salvarAgora]);

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
            <p className="truncate text-sm font-medium text-ink-subtle line-through">
              {membro.nome}
            </p>
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

  return (
    <li className="py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-ink">
          {membro.nome}
        </p>
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
        <Segmentado
          valor={naoLancado ? null : presente ? "sim" : "nao"}
          opcoes={[
            { valor: "sim", rotulo: "Presente", corAtiva: "bg-brand text-white" },
            { valor: "nao", rotulo: "Ausente", corAtiva: "bg-warn text-white" },
          ]}
          onEscolher={(v) => {
            setPresente(v === "sim");
            agendarSave(DEBOUNCE_TOGGLE_MS);
          }}
        />

        {presente ? (
          <>
            <Segmentado
              valor={naoLancado ? null : pontualidade}
              opcoes={[
                {
                  valor: "pontual",
                  rotulo: "Pontual",
                  corAtiva: "bg-brand text-white",
                },
                {
                  valor: "atrasado",
                  rotulo: "Atrasado",
                  corAtiva: "bg-warn text-white",
                },
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
