import "server-only";
import { can } from "@/lib/rbac";
import type { UsuarioAtual } from "@/lib/auth";

// ─────────────────────────────────────────────────────────────────────────
// Escopo de acesso à tela de Membros (/membros e /membros/[id]).
//
//  total   → admin/super_admin: veem e editam QUALQUER membro (inclui e-mail,
//            equipe, nível/status via /usuarios).
//  equipe  → líder: vê e edita SÓ os membros da própria equipe, e apenas os
//            dados de PERFIL (nome, celular, nascimento, observação, foto) —
//            nunca e-mail, equipe, nível ou status.
//  nenhum  → demais níveis: sem acesso.
//
// Fonte única para decidir escopo tanto na renderização quanto na autorização
// das actions (nunca confie no que veio do cliente).
// ─────────────────────────────────────────────────────────────────────────

export type AcessoMembros = "total" | "equipe" | "nenhum";

export function acessoMembros(usuario: UsuarioAtual): AcessoMembros {
  if (can(usuario.nivelAcesso, "gerenciar_membros")) return "total";
  if (can(usuario.nivelAcesso, "ver_membros_equipe")) return "equipe";
  return "nenhum";
}
