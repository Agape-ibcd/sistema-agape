"use client";

import Link from "next/link";
import { Popover } from "@/components/Popover";

// Ações administrativas do calendário recolhidas num menu suspenso —
// mantém só "+ Evento avulso" como botão primário à vista.
export function AcoesEventos({
  podeGerirEscalas,
  podeGerirTipos,
}: {
  podeGerirEscalas: boolean;
  podeGerirTipos: boolean;
}) {
  if (!podeGerirEscalas && !podeGerirTipos) return null;

  const itemCls =
    "block rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-2";

  return (
    <Popover rotulo="Gerenciar" align="right">
      {(fechar) => (
        <nav className="flex flex-col gap-1">
          {podeGerirEscalas && (
            <Link href="/eventos/rodizio" onClick={fechar} className={itemCls}>
              Rodízio de escalas
            </Link>
          )}
          {podeGerirTipos && (
            <Link href="/eventos/tipos" onClick={fechar} className={itemCls}>
              Tipos de evento
            </Link>
          )}
        </nav>
      )}
    </Popover>
  );
}
