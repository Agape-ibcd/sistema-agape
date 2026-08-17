import type { NivelAcesso } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────
// RBAC — Matriz de permissões (PDF, seção 5 "Níveis de acesso — detalhado";
// nível `monitor` acrescentado na sessão de melhorias de 2026-07-12).
// Fonte única da verdade para o que cada nível pode fazer. Usada tanto no
// menu (esconder itens) quanto na autorização das rotas/actions (bloquear).
// ─────────────────────────────────────────────────────────────────────────

export type Permissao =
  | "gerenciar_usuarios" // criar/editar níveis de acesso, inativar admins
  | "gerenciar_tipos_evento" // criar/editar tipos de evento e recorrência
  | "criar_eventos_extras" // eventos extras/especiais
  | "gerenciar_escalas"
  | "ver_calendario" // ver o calendário de eventos/escalas (leitura)
  | "exportar_agenda" // exportar agenda/escalas do próprio escopo (monitor não)
  | "gerenciar_membros" // cadastrar/editar QUALQUER membro (admin/super)
  | "ver_membros_todos" // monitor: ver a lista completa de membros, só leitura
  | "ver_membros_equipe" // líder: ver a lista de membros da própria equipe
  | "editar_membros_equipe" // líder: editar dados de perfil dos membros da própria equipe
  | "ver_agenda_equipe" // líder: ver a agenda (calendário) restrita à própria equipe
  | "registrar_presenca_qualquer" // presença de qualquer equipe
  | "registrar_presenca_propria" // presença apenas da própria equipe
  | "dashboard_geral" // dashboard de todas as equipes
  | "dashboard_equipe" // dashboard restrito à própria equipe
  | "ver_perfil_proprio"
  | "editar_perfil_proprio" // alterar os próprios dados (celular, observação, foto)
  | "painel_aniversariantes"
  | "configuracoes_sistema"
  | "aprovar_candidaturas"; // ver/decidir solicitações de novo membro (Convite ao Ministério)

// Matriz nível → permissões concedidas.
const MATRIZ: Record<NivelAcesso, Permissao[]> = {
  super_admin: [
    "gerenciar_usuarios",
    "gerenciar_tipos_evento",
    "criar_eventos_extras",
    "gerenciar_escalas",
    "ver_calendario",
    "exportar_agenda",
    "gerenciar_membros",
    "registrar_presenca_qualquer",
    "registrar_presenca_propria",
    "dashboard_geral",
    "dashboard_equipe",
    "ver_perfil_proprio",
    "editar_perfil_proprio",
    "painel_aniversariantes",
    "configuracoes_sistema",
    "aprovar_candidaturas",
  ],
  admin: [
    "gerenciar_tipos_evento",
    "criar_eventos_extras",
    "gerenciar_escalas",
    "ver_calendario",
    "exportar_agenda",
    "gerenciar_membros",
    "registrar_presenca_qualquer",
    "registrar_presenca_propria",
    "dashboard_geral",
    "dashboard_equipe",
    "ver_perfil_proprio",
    "editar_perfil_proprio",
    "painel_aniversariantes",
    "aprovar_candidaturas",
  ],
  // Monitor: acompanha os INDICADORES (dashboard geral) em modo LEITURA.
  // Não vê eventos/escalas nem gerencia nada, e não pertence a nenhuma equipe
  // (atribuir o nível remove o vínculo de equipe). Pode, porém, EDITAR o
  // próprio perfil e ver o painel de aniversariantes (ajuste de 2026-07-19).
  // Também vê a lista completa de Membros, só leitura — nunca edita dados de
  // ninguém (ajuste de 2026-08-17).
  monitor: [
    "dashboard_geral",
    "dashboard_equipe",
    "ver_membros_todos",
    "ver_perfil_proprio",
    "editar_perfil_proprio",
    "painel_aniversariantes",
  ],
  // Líder: além do próprio perfil, vê e edita (só dados de perfil) os membros
  // da PRÓPRIA equipe e vê a agenda restrita à própria equipe. Não gerencia
  // escalas, tipos de evento nem outros níveis.
  lider: [
    "ver_membros_equipe",
    "editar_membros_equipe",
    "ver_agenda_equipe",
    "registrar_presenca_propria",
    "dashboard_equipe",
    "exportar_agenda",
    "ver_perfil_proprio",
    "editar_perfil_proprio",
    "painel_aniversariantes",
  ],
  membro: [
    "exportar_agenda",
    "ver_perfil_proprio",
    "editar_perfil_proprio",
    "painel_aniversariantes",
  ],
};

// Ordem hierárquica (maior = mais poder). Útil para comparações "nível >= X".
// O monitor fica entre membro e líder: enxerga muito, mas não altera nada —
// NUNCA use hierarquia para autorizar escrita; use permissões específicas.
export const HIERARQUIA: Record<NivelAcesso, number> = {
  membro: 1,
  monitor: 2,
  lider: 3,
  admin: 4,
  super_admin: 5,
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
  monitor: "Monitor",
  lider: "Líder",
  membro: "Membro",
};
