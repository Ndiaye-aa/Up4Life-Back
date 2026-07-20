export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET não está definido. Configure a variável de ambiente antes de iniciar a aplicação.',
    );
  }
  return secret;
}
