import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizarTelefone } from '../../common/utils/telefone';
import { RegisterPersonalDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  getAccessTokenExpiresIn,
  getCookieDomain,
  getRefreshTokenExpiresInMs,
  isProductionEnv,
} from '../../common/config/env';

// Hash de senha inexistente: comparado quando o telefone não está cadastrado,
// para que o tempo de resposta não revele quais telefones existem no banco.
const DUMMY_HASH = bcrypt.hashSync('senha-invalida-para-timing', 10);

type Role = 'PERSONAL' | 'ALUNO';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private async issueTokens(
    id: number,
    role: Role,
    userAgent?: string,
  ): Promise<AuthTokens> {
    const accessToken = this.jwtService.sign(
      { sub: id, role },
      { expiresIn: getAccessTokenExpiresIn() as never },
    );

    const rawRefreshToken = crypto.randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(rawRefreshToken),
        personalId: role === 'PERSONAL' ? id : null,
        alunoId: role === 'ALUNO' ? id : null,
        role,
        expiresAt: new Date(Date.now() + getRefreshTokenExpiresInMs()),
        userAgent,
      },
    });

    const csrfToken = crypto.randomBytes(32).toString('base64url');

    return { accessToken, refreshToken: rawRefreshToken, csrfToken };
  }

  setAuthCookies(res: Response, tokens: AuthTokens) {
    const isProd = isProductionEnv();
    const base = {
      httpOnly: true,
      secure: isProd,
      sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
      domain: getCookieDomain(),
      path: '/',
    };

    res.cookie('access_token', tokens.accessToken, {
      ...base,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      ...base,
      path: '/auth',
      maxAge: getRefreshTokenExpiresInMs(),
    });
    res.cookie('csrf_token', tokens.csrfToken, {
      ...base,
      httpOnly: false,
      maxAge: getRefreshTokenExpiresInMs(),
    });
  }

  clearAuthCookies(res: Response) {
    const isProd = isProductionEnv();
    const base = {
      httpOnly: true,
      secure: isProd,
      sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
      domain: getCookieDomain(),
      path: '/',
    };

    res.clearCookie('access_token', base);
    res.clearCookie('refresh_token', { ...base, path: '/auth' });
    res.clearCookie('csrf_token', { ...base, httpOnly: false });
  }

  async registerPersonal(dto: RegisterPersonalDto) {
    const telefone = normalizarTelefone(dto.telefone);
    const existingUser = await this.prisma.personal.findUnique({
      where: { telefone },
    });
    if (existingUser) {
      throw new ConflictException('Telefone já cadastrado.');
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(dto.senha, salt);

    try {
      const personal = await this.prisma.personal.create({
        data: {
          nome: dto.nome,
          telefone,
          senha: hashedPassword,
        },
      });

      const { senha: _senha, ...result } = personal;
      return result;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Telefone já cadastrado.');
      }
      throw error;
    }
  }

  async loginPersonal(dto: LoginDto, userAgent?: string) {
    const telefone = normalizarTelefone(dto.telefone);
    const personal = await this.prisma.personal.findUnique({
      where: { telefone },
    });

    const isMatch = await bcrypt.compare(
      dto.senha,
      personal?.senha ?? DUMMY_HASH,
    );
    if (!personal || !isMatch) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const { senha: _senha, ...result } = personal;
    const tokens = await this.issueTokens(personal.id, 'PERSONAL', userAgent);

    return {
      user: { ...result, role: 'PERSONAL' },
      // access_token no corpo é retrocompatibilidade temporária com o front
      // antigo (Fase 1 do rollout) — remover quando só o cookie for aceito.
      access_token: tokens.accessToken,
      tokens,
    };
  }

  async loginAluno(dto: LoginDto, userAgent?: string) {
    const telefone = normalizarTelefone(dto.telefone);
    const aluno = await this.prisma.aluno.findUnique({ where: { telefone } });

    const isMatch = await bcrypt.compare(dto.senha, aluno?.senha ?? DUMMY_HASH);
    if (!aluno || !isMatch) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (!aluno.ativo) {
      throw new UnauthorizedException(
        'Conta desativada. Fale com seu personal.',
      );
    }

    const { senha: _senha, ...result } = aluno;
    const tokens = await this.issueTokens(aluno.id, 'ALUNO', userAgent);

    return {
      user: { ...result, role: 'ALUNO' },
      access_token: tokens.accessToken,
      tokens,
    };
  }

  async refresh(rawRefreshToken: string | undefined, userAgent?: string) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token ausente.');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    if (stored.revokedAt) {
      // Reuse de um token já rotacionado: sinal de roubo. Contém o dano
      // revogando todas as sessões desse usuário.
      await this.prisma.refreshToken.updateMany({
        where: {
          revokedAt: null,
          ...(stored.role === 'PERSONAL'
            ? { personalId: stored.personalId }
            : { alunoId: stored.alunoId }),
        },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Sessão inválida.');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessão expirada.');
    }

    const id = stored.role === 'PERSONAL' ? stored.personalId : stored.alunoId;
    if (id === null) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const role = stored.role as Role;
    if (role === 'PERSONAL') {
      const personal = await this.prisma.personal.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!personal) {
        throw new UnauthorizedException('Sessão inválida.');
      }
    } else {
      const aluno = await this.prisma.aluno.findUnique({
        where: { id },
        select: { id: true, ativo: true },
      });
      if (!aluno || !aluno.ativo) {
        throw new UnauthorizedException('Sessão inválida.');
      }
    }

    const tokens = await this.issueTokens(id, role, userAgent);

    await this.prisma.refreshToken.update({
      where: { tokenHash },
      data: {
        revokedAt: new Date(),
        replacedBy: this.hashToken(tokens.refreshToken),
      },
    });

    return tokens;
  }

  async revokeRefreshToken(rawRefreshToken: string | undefined) {
    if (!rawRefreshToken) {
      return;
    }
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getCurrentUser(user: { id: number; role: Role }) {
    if (user.role === 'PERSONAL') {
      const personal = await this.prisma.personal.findUnique({
        where: { id: user.id },
      });
      if (!personal) {
        throw new UnauthorizedException('Sessão inválida.');
      }
      const { senha: _senha, ...result } = personal;
      return { user: { ...result, role: 'PERSONAL' } };
    }

    const aluno = await this.prisma.aluno.findUnique({
      where: { id: user.id },
    });
    if (!aluno || !aluno.ativo) {
      throw new UnauthorizedException('Sessão inválida.');
    }
    const { senha: _senha, ...result } = aluno;
    return { user: { ...result, role: 'ALUNO' } };
  }
}
