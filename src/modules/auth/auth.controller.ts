import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterPersonalDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';

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
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async loginPersonal(@Body() dto: LoginDto) {
    return this.authService.loginPersonal(dto);
  }

  // Cadastro de aluno é feito exclusivamente pelo personal autenticado via POST /alunos.
  // Não há rota pública de auto-registro de aluno (evita vínculo a personalId arbitrário).

  @Post('aluno/login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async loginAluno(@Body() dto: LoginDto) {
    return this.authService.loginAluno(dto);
  }
}
