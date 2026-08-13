import type { Permissao } from "@/lib/rbac";

// Itens do menu principal. Cada item declara a permissão mínima para aparecer;
// itens sem `permissao`/`permissoesAny` são visíveis a qualquer usuário
// autenticado. `permissoesAny` = aparece se o usuário tiver QUALQUER UMA das
// permissões da lista (usado quando a mesma tela atende níveis diferentes com
// escopos distintos — ex.: admin com acesso total e líder com escopo de equipe).
export type ItemMenu = {
  href: string;
  label: string;
  permissao?: Permissao;
  permissoesAny?: Permissao[];
  etapa?: number; // etapa do plano em que a tela é construída (rótulo "em breve")
  // Destaque visual (dourado com fundo gradiente escuro) — reservado para o
  // item "Nosso Servir" (pedido do usuário em 2026-08-13).
  destaque?: boolean;
};

// Decide se um item deve aparecer para um nível, dada a checagem `can`.
export function itemVisivel(
  item: ItemMenu,
  temPermissao: (p: Permissao) => boolean,
): boolean {
  if (item.permissoesAny && item.permissoesAny.length > 0) {
    return item.permissoesAny.some(temPermissao);
  }
  if (item.permissao) return temPermissao(item.permissao);
  return true;
}

export const ITENS_MENU: ItemMenu[] = [
  // Primeiro item de propósito (pedido do usuário): captação de novos membros.
  // Visível a QUALQUER usuário logado — todo mundo pode convidar alguém.
  { href: "/convite", label: "Convite ao Ministério" },
  // Dashboard visível a qualquer usuário autenticado: a própria página resolve
  // o escopo por nível (geral/equipe/próprio). O membro cai na visão "perfil
  // próprio", conforme o plano.
  { href: "/dashboard", label: "Dashboard" },
  { href: "/presenca", label: "Registrar Presença", permissao: "registrar_presenca_propria", etapa: 4 },
  // Leitura basta para o item aparecer (nível monitor); os controles de
  // escrita dentro das telas exigem as permissões específicas.
  { href: "/eventos", label: "Eventos e Escalas", permissoesAny: ["ver_calendario", "ver_agenda_equipe"], etapa: 3 },
  { href: "/membros", label: "Membros", permissoesAny: ["gerenciar_membros", "ver_membros_equipe"], etapa: 3 },
  { href: "/equipes", label: "Equipes", permissao: "gerenciar_membros", etapa: 3 },
  { href: "/aniversariantes", label: "Aniversariantes", permissao: "painel_aniversariantes" },
  { href: "/solicitacoes", label: "Solicitações", permissao: "aprovar_candidaturas" },
  { href: "/usuarios", label: "Usuários e Acessos", permissao: "gerenciar_usuarios", etapa: 3 },
  { href: "/configuracoes", label: "Configurações", permissao: "configuracoes_sistema" },
  { href: "/auditoria", label: "Auditoria", permissao: "configuracoes_sistema" },
  { href: "/perfil", label: "Meu Perfil" },
  // Último item do menu (pedido do usuário): página institucional
  // (regras/orientações do Ministério) — a mesma URL pública usada no botão
  // do e-mail de agradecimento da candidatura, também acessível por qualquer
  // usuário logado. Item com destaque visual (dourado).
  { href: "/nosso-servir", label: "Nosso Servir", destaque: true },
];
