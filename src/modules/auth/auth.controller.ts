import { Controller, Post, Get, Body, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterPersonalDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public, RequireAuth } from './decorators/public.decorator';
import { SkipCsrf } from './decorators/skip-csrf.decorator';
import { User, type RequestUser } from './decorators/user.decorator';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('personal/register')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async registerPersonal(@Body() dto: RegisterPersonalDto) {
    return this.authService.registerPersonal(dto);
  }

  @Post('personal/login')
  @SkipCsrf()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async loginPersonal(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, access_token, tokens } = await this.authService.loginPersonal(
      dto,
      req.headers['user-agent'],
    );
    this.authService.setAuthCookies(res, tokens);
    return { user, access_token };
  }

  // Cadastro de aluno é feito exclusivamente pelo personal autenticado via POST /alunos.
  // Não há rota pública de auto-registro de aluno (evita vínculo a personalId arbitrário).

  @Post('aluno/login')
  @SkipCsrf()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async loginAluno(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, access_token, tokens } = await this.authService.loginAluno(
      dto,
      req.headers['user-agent'],
    );
    this.authService.setAuthCookies(res, tokens);
    return { user, access_token };
  }

  // Não exige JwtAuthGuard: o access token pode estar expirado (é exatamente
  // por isso que o cliente está chamando refresh). A validação acontece toda
  // via o refresh_token cookie, no service.
  @Post('refresh')
  @Public()
  @SkipCsrf()
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refresh(
      req.cookies?.refresh_token,
      req.headers['user-agent'],
    );
    this.authService.setAuthCookies(res, tokens);
    return { ok: true };
  }

  @Post('logout')
  @RequireAuth()
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.revokeRefreshToken(req.cookies?.refresh_token);
    this.authService.clearAuthCookies(res);
    return { ok: true };
  }

  @Get('me')
  @RequireAuth()
  async me(@User() user: RequestUser) {
    return this.authService.getCurrentUser(user);
  }
}
