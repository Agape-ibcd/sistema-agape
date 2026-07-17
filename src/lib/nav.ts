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
  // Dashboard visível a qualquer usuário autenticado: a própria página resolve
  // o escopo por nível (geral/equipe/próprio). O membro cai na visão "perfil
  // próprio", conforme o plano.
  { href: "/dashboard", label: "Dashboard" },
  { href: "/presenca", label: "Registrar Presença", permissao: "registrar_presenca_propria", etapa: 4 },
  // Leitura basta para o item aparecer (nível monitor); os controles de
  // escrita dentro das telas exigem as permissões específicas.
  { href: "/eventos", label: "Eventos e Escalas", permissao: "ver_calendario", etapa: 3 },
  { href: "/membros", label: "Membros", permissao: "gerenciar_membros", etapa: 3 },
  { href: "/equipes", label: "Equipes", permissao: "gerenciar_membros", etapa: 3 },
  { href: "/aniversariantes", label: "Aniversariantes", permissao: "painel_aniversariantes" },
  { href: "/usuarios", label: "Usuários e Acessos", permissao: "gerenciar_usuarios", etapa: 3 },
  { href: "/configuracoes", label: "Configurações", permissao: "configuracoes_sistema" },
  { href: "/perfil", label: "Meu Perfil" },
];
