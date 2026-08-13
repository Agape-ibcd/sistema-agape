"use client";

import { useEffect, useState } from "react";

export type ConviteDados = {
  id: string;
  criadoPorNome: string;
  origem: "link" | "email";
  emailConvidado: string | null;
  criadoEm: string; // dd/mm/aaaa
  expiraEmISO: string;
  qtdCandidaturas: number;
};

function formatarRestante(expiraEmISO: string): { texto: string; expirado: boolean } {
  const diffMs = new Date(expiraEmISO).getTime() - Date.now();
  if (diffMs <= 0) return { texto: "Expirado", expirado: true };
  const dias = Math.floor(diffMs / 86_400_000);
  const horas = Math.floor((diffMs % 86_400_000) / 3_600_000);
  if (dias > 0) return { texto: `${dias}d ${horas}h restantes`, expirado: false };
  const minutos = Math.floor((diffMs % 3_600_000) / 60_000);
  return { texto: `${horas}h ${minutos}min restantes`, expirado: false };
}

// Lista de TODOS os convites gerados (por qualquer usuário) — o Admin
// acompanha quem gerou quantos e quanto falta para cada um expirar. A
// contagem regressiva é recalculada a cada minuto no navegador.
export function ConvitesLista({ convites }: { convites: ConviteDados[] }) {
  const [, forcar] = useState(0);

  useEffect(() => {
    const intervalo = setInterval(() => forcar((n) => n + 1), 60_000);
    return () => clearInterval(intervalo);
  }, []);

  if (convites.length === 0) {
    return (
      <p className="rounded-2xl border border-edge-soft vidro-leve p-6 text-center text-sm text-ink-subtle">
        Nenhum convite gerado ainda.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-edge-soft overflow-hidden rounded-2xl border border-edge-soft vidro-leve">
      {convites.map((c) => {
        const restante = formatarRestante(c.expiraEmISO);
        return (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                {c.criadoPorNome}
                <span className="ml-2 text-xs font-normal text-ink-subtle">
                  {c.origem === "email" ? `enviou por e-mail para ${c.emailConvidado}` : "gerou link compartilhável"}
                </span>
              </p>
              <p className="text-xs text-ink-subtle">
                Gerado em {c.criadoEm}
                {c.qtdCandidaturas > 0
                  ? ` · já resultou em ${c.qtdCandidaturas} candidatura(s)`
                  : ""}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                restante.expirado
                  ? "bg-surface-3 text-ink-soft"
                  : "bg-brand-soft text-brand-text"
              }`}
            >
              {restante.texto}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
