import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { getJwtSecret } from '../../../common/config/env';

interface JwtPayload {
  sub: number;
  role: 'PERSONAL' | 'ALUNO';
}

// Extrai do cookie httpOnly `access_token`. Aceitar também o header Bearer é
// uma retrocompatibilidade temporária durante o rollout (ver Fase 3 do plano
// de migração para cookies) — remover fromAuthHeaderAsBearerToken depois que
// nenhum cliente antigo depender mais dele.
const cookieExtractor = (req: Request): string | null => {
  return req?.cookies?.access_token || null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  // Revalida o dono do token a cada requisição: usuário removido (ou aluno
  // desativado) perde o acesso imediatamente, mesmo com token ainda não expirado.
  async validate(payload: JwtPayload) {
    if (payload.role === 'PERSONAL') {
      const personal = await this.prisma.personal.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      });
      if (!personal) {
        throw new UnauthorizedException('Sessão inválida.');
      }
    } else if (payload.role === 'ALUNO') {
      const aluno = await this.prisma.aluno.findUnique({
        where: { id: payload.sub },
        select: { id: true, ativo: true },
      });
      if (!aluno || !aluno.ativo) {
        throw new UnauthorizedException('Sessão inválida.');
      }
    } else {
      throw new UnauthorizedException('Sessão inválida.');
    }

    return { id: payload.sub, role: payload.role };
  }
}
