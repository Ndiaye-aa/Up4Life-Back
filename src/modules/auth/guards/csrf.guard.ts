import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator';
import { isProductionEnv } from '../../../common/config/env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Defesa contra CSRF via double-submit cookie: o login também seta um cookie
// `csrf_token` legível por JS (não httpOnly); o front deve reenviá-lo no
// header `X-CSRF-Token` em toda chamada mutante. Um atacante cross-site
// consegue fazer o navegador enviar os cookies httpOnly (SameSite=None), mas
// não consegue ler `csrf_token` para replicá-lo no header.
//
// Em produção o bloqueio é sempre ativo — não depende de lembrar de setar uma
// env var. CSRF_ENFORCE=true permite ligar o bloqueio também fora de
// produção (staging, teste manual do rollout); CSRF_ENFORCE nunca desliga o
// bloqueio quando NODE_ENV=production.
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(req.method)) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(
      SKIP_CSRF_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic || skipCsrf) {
      return true;
    }

    const cookieToken = req.cookies?.csrf_token;
    const headerToken = req.headers['x-csrf-token'];
    const matches =
      typeof cookieToken === 'string' &&
      typeof headerToken === 'string' &&
      cookieToken === headerToken &&
      cookieToken.length > 0;

    if (matches) {
      return true;
    }

    const enforce = isProductionEnv() || process.env.CSRF_ENFORCE === 'true';
    if (!enforce) {
      this.logger.warn(
        `CSRF token ausente/divergente em ${req.method} ${req.originalUrl} (modo observação, requisição permitida)`,
      );
      return true;
    }

    throw new ForbiddenException('CSRF token inválido ou ausente.');
  }
}
