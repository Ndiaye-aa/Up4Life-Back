// Telefone é a chave de login: toda escrita/busca no banco deve usar o formato
// normalizado (somente dígitos) para não quebrar o login nem burlar o @unique.
export function normalizarTelefone(telefone: string): string {
  return telefone.replace(/\D/g, '');
}
