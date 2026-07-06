import type { Permissao } from "@/lib/rbac";

// Itens do menu principal. Cada item declara a permissão mínima para aparecer;
// itens sem `permissao` são visíveis a qualquer usuário autenticado.
export type ItemMenu = {
  href: string;
  label: string;
  permissao?: Permissao;
  etapa?: number; // etapa do plano em que a tela é construída (rótulo "em breve")
};

export const ITENS_MENU: ItemMenu[] = [
  { href: "/dashboard", label: "Dashboard", permissao: "dashboard_equipe", etapa: 5 },
  { href: "/presenca", label: "Registrar Presença", permissao: "registrar_presenca_propria", etapa: 4 },
  { href: "/eventos", label: "Eventos e Escalas", permissao: "gerenciar_escalas", etapa: 3 },
  { href: "/membros", label: "Membros", permissao: "gerenciar_membros", etapa: 3 },
  { href: "/equipes", label: "Equipes", permissao: "gerenciar_membros", etapa: 3 },
  { href: "/aniversariantes", label: "Aniversariantes", permissao: "painel_aniversariantes", etapa: 5 },
  { href: "/usuarios", label: "Usuários e Acessos", permissao: "gerenciar_usuarios", etapa: 3 },
  { href: "/configuracoes", label: "Configurações", permissao: "configuracoes_sistema", etapa: 6 },
  { href: "/perfil", label: "Meu Perfil" },
];
