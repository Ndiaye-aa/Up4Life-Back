/**
 * Teto de segurança das listagens que ainda não têm paginação. Mantém os
 * registros mais recentes; ao atingir o teto o serviço registra um aviso para
 * que a paginação seja priorizada antes de alguém perder dados na tela.
 */
export const LIMITE_LISTAGEM = 1000;
