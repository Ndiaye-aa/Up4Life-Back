import { ExecutionContext } from '@nestjs/common';
import { JobSecretGuard } from './job-secret.guard';

const SECRET = 'x'.repeat(40);

const contexto = (header?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: header ? { 'x-job-secret': header } : {} }),
    }),
  }) as unknown as ExecutionContext;

describe('JobSecretGuard', () => {
  const guard = new JobSecretGuard();

  beforeEach(() => {
    process.env.JOB_SECRET = SECRET;
  });

  it('libera com o secret correto', () => {
    expect(guard.canActivate(contexto(SECRET))).toBe(true);
  });

  it('bloqueia sem header, com secret errado ou de tamanho diferente', () => {
    expect(guard.canActivate(contexto())).toBe(false);
    expect(guard.canActivate(contexto('y'.repeat(40)))).toBe(false);
    expect(guard.canActivate(contexto('curto'))).toBe(false);
  });
});
