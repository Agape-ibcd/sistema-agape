// Rótulos amigáveis para os valores crus gravados em AuditLog.acao/tabelaAfetada
// (ver writeAudit em audit.ts). Puro — sem server-only — para poder ser
// importado tanto pelo componente client de filtros quanto pela página.

export const ROTULO_ACAO: Record<string, string> = {
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir",
  restaurar: "Restaurar",
  login: "Login",
  logout: "Logout",
  conceder_acesso: "Conceder acesso",
  conceder_acesso_em_massa: "Conceder acesso (em massa)",
  revogar_acesso: "Revogar acesso",
  redefinir_senha: "Redefinir senha",
  alterar_senha: "Alterar senha",
  trocar_senha_obrigatoria: "Trocar senha (obrigatória)",
  recuperar_senha: "Recuperar senha",
  enviar_credenciais: "Enviar credenciais",
  aplicar_rodizio: "Aplicar rodízio",
  gerar_eventos: "Gerar eventos",
  trocar_escala: "Trocar escala",
};

export const ROTULO_TABELA: Record<string, string> = {
  membros: "Membros",
  equipes: "Equipes",
  equipe_lideres: "Líderes de equipe",
  tipos_evento: "Tipos de evento",
  eventos: "Eventos",
  escala_equipe_evento: "Escalas",
  presenca: "Presença",
  rodizio_escala: "Rodízio de escalas",
  confirmacao_escala: "Confirmação de escala",
  config_notificacao: "Configuração de notificações",
};

export function rotuloAcao(acao: string): string {
  return ROTULO_ACAO[acao] ?? acao;
}

export function rotuloTabela(tabela: string): string {
  return ROTULO_TABELA[tabela] ?? tabela;
}
