export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET não está definido. Configure a variável de ambiente antes de iniciar a aplicação.',
    );
  }
  return secret;
}

export function getAccessTokenExpiresIn(): string {
  return process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
}

export function getRefreshTokenExpiresIn(): string {
  return process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';
}

export function getRefreshTokenExpiresInMs(): number {
  return parseDurationToMs(getRefreshTokenExpiresIn());
}

function parseDurationToMs(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(
      `Duração inválida: "${value}". Use algo como "30d", "15m", "1h".`,
    );
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const unitMs: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * unitMs[unit];
}

export function getCookieDomain(): string | undefined {
  return process.env.COOKIE_DOMAIN || undefined;
}

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Autentica os gatilhos externos dos jobs (cron-job.org, GitHub Actions). */
export function getJobSecret(): string {
  const secret = process.env.JOB_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JOB_SECRET não está definido (ou tem menos de 32 caracteres). Configure a variável de ambiente antes de iniciar a aplicação.',
    );
  }
  return secret;
}

const flagLigada = (nome: string): boolean =>
  (process.env[nome] ?? '').trim().toLowerCase() === 'true';

export const faltasAutomaticasHabilitado = (): boolean =>
  flagLigada('FALTAS_AUTOMATICAS_ENABLED');

export const faltasNotificacaoHabilitado = (): boolean =>
  flagLigada('FALTAS_NOTIFICACAO_ENABLED');
