import type { NivelAcesso } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────
// RBAC — Matriz de permissões (PDF, seção 5 "Níveis de acesso — detalhado").
// Fonte única da verdade para o que cada nível pode fazer. Usada tanto no
// menu (esconder itens) quanto na autorização das rotas/actions (bloquear).
// ─────────────────────────────────────────────────────────────────────────

export type Permissao =
  | "gerenciar_usuarios" // criar/editar níveis de acesso, inativar admins
  | "gerenciar_tipos_evento" // criar/editar tipos de evento e recorrência
  | "criar_eventos_extras" // eventos extras/especiais
  | "gerenciar_escalas"
  | "gerenciar_membros" // cadastrar/editar membros
  | "registrar_presenca_qualquer" // presença de qualquer equipe
  | "registrar_presenca_propria" // presença apenas da própria equipe
  | "dashboard_geral" // dashboard de todas as equipes
  | "dashboard_equipe" // dashboard restrito à própria equipe
  | "ver_perfil_proprio"
  | "painel_aniversariantes"
  | "configuracoes_sistema";

// Matriz nível → permissões concedidas.
const MATRIZ: Record<NivelAcesso, Permissao[]> = {
  super_admin: [
    "gerenciar_usuarios",
    "gerenciar_tipos_evento",
    "criar_eventos_extras",
    "gerenciar_escalas",
    "gerenciar_membros",
    "registrar_presenca_qualquer",
    "registrar_presenca_propria",
    "dashboard_geral",
    "dashboard_equipe",
    "ver_perfil_proprio",
    "painel_aniversariantes",
    "configuracoes_sistema",
  ],
  admin: [
    "gerenciar_tipos_evento",
    "criar_eventos_extras",
    "gerenciar_escalas",
    "gerenciar_membros",
    "registrar_presenca_qualquer",
    "registrar_presenca_propria",
    "dashboard_geral",
    "dashboard_equipe",
    "ver_perfil_proprio",
    "painel_aniversariantes",
  ],
  lider: [
    "registrar_presenca_propria",
    "dashboard_equipe",
    "ver_perfil_proprio",
    "painel_aniversariantes",
  ],
  membro: ["ver_perfil_proprio", "painel_aniversariantes"],
};

// Ordem hierárquica (maior = mais poder). Útil para comparações "nível >= X".
export const HIERARQUIA: Record<NivelAcesso, number> = {
  membro: 1,
  lider: 2,
  admin: 3,
  super_admin: 4,
};

export function can(nivel: NivelAcesso, permissao: Permissao): boolean {
  return MATRIZ[nivel]?.includes(permissao) ?? false;
}

export function nivelPeloMenos(
  nivel: NivelAcesso,
  minimo: NivelAcesso,
): boolean {
  return HIERARQUIA[nivel] >= HIERARQUIA[minimo];
}

// Rótulos legíveis para exibição.
export const ROTULO_NIVEL: Record<NivelAcesso, string> = {
  super_admin: "Super Administrador",
  admin: "Administrador",
  lider: "Líder",
  membro: "Membro",
};
