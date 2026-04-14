import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterPersonalDto, RegisterAlunoDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async registerPersonal(dto: RegisterPersonalDto) {
    const existingUser = await this.prisma.personal.findUnique({ where: { telefone: dto.telefone } });
    if (existingUser) {
      throw new ConflictException('Telefone já cadastrado.');
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(dto.senha, salt);

    const personal = await this.prisma.personal.create({
      data: {
        nome: dto.nome,
        telefone: dto.telefone,
        senha: hashedPassword,
      },
    });

    // Removendo senha do retorno
    const { senha, ...result } = personal;
    return result;
  }

  async loginPersonal(dto: LoginDto) {
    const personal = await this.prisma.personal.findUnique({ where: { telefone: dto.telefone } });
    if (!personal) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const isMatch = await bcrypt.compare(dto.senha, personal.senha);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const payload = { sub: personal.id, role: 'PERSONAL' };
    const { senha, ...result } = personal;

    return {
      user: result,
      access_token: this.jwtService.sign(payload),
    };
  }

  async registerAluno(dto: RegisterAlunoDto) {
    const existingAluno = await this.prisma.aluno.findUnique({ where: { telefone: dto.telefone } });
    if (existingAluno) {
      throw new ConflictException('Telefone já cadastrado como aluno.');
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(dto.senha, salt);

    const aluno = await this.prisma.aluno.create({
      data: {
        nome: dto.nome,
        telefone: dto.telefone,
        senha: hashedPassword,
        personalId: dto.personalId,
      },
    });

    const { senha, ...result } = aluno;
    return result;
  }

  async loginAluno(dto: LoginDto) {
    const aluno = await this.prisma.aluno.findUnique({ where: { telefone: dto.telefone } });
    if (!aluno) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const isMatch = await bcrypt.compare(dto.senha, aluno.senha);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const payload = { sub: aluno.id, role: 'ALUNO' };
    const { senha, ...result } = aluno;

    return {
      user: result,
      access_token: this.jwtService.sign(payload),
    };
  }
}
