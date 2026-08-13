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

// Confere se o usuário pode editar (dados/foto/status) o membro-alvo
// específico. Além do escopo geral de acessoMembros(), aplica a única
// restrição hierárquica dentro do acesso "total": admin não edita
// super_admin (só outro super_admin pode). O líder já é restrito à própria
// equipe por acessoMembros() = "equipe"; aqui só confirmamos o vínculo.
export function podeEditarMembroAlvo(
  usuario: UsuarioAtual,
  alvo: { nivelAcesso: string; equipeId: string | null },
): boolean {
  const acesso = acessoMembros(usuario);
  if (acesso === "nenhum") return false;
  if (acesso === "equipe") return alvo.equipeId === usuario.equipeId;
  // acesso === "total"
  if (usuario.nivelAcesso === "admin" && alvo.nivelAcesso === "super_admin") {
    return false;
  }
  return true;
}
