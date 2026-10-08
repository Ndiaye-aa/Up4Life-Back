import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { getJobSecret } from '../config/env';

@Injectable()
export class JobSecretGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const recebido = Buffer.from(String(req.headers['x-job-secret'] ?? ''));
    const esperado = Buffer.from(getJobSecret());
    return (
      recebido.length === esperado.length && timingSafeEqual(recebido, esperado)
    );
  }
}
