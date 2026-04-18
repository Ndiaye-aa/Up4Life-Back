import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterPersonalDto, RegisterAlunoDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('personal/register')
  async registerPersonal(@Body() dto: RegisterPersonalDto) {
    return this.authService.registerPersonal(dto);
  }

  @Post('personal/login')
  async loginPersonal(@Body() dto: LoginDto) {
    return this.authService.loginPersonal(dto);
  }

  @Post('aluno/register')
  async registerAluno(@Body() dto: RegisterAlunoDto) {
    return this.authService.registerAluno(dto);
  }

  @Post('aluno/login')
  async loginAluno(@Body() dto: LoginDto) {
    return this.authService.loginAluno(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
