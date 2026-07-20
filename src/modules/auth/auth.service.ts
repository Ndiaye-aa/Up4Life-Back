import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizarTelefone } from '../../common/utils/telefone';
import { RegisterPersonalDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// Hash de senha inexistente: comparado quando o telefone não está cadastrado,
// para que o tempo de resposta não revele quais telefones existem no banco.
const DUMMY_HASH = bcrypt.hashSync('senha-invalida-para-timing', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

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

  async loginPersonal(dto: LoginDto) {
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

    const payload = { sub: personal.id, role: 'PERSONAL' };
    const { senha: _senha, ...result } = personal;

    return {
      user: { ...result, role: 'PERSONAL' },
      access_token: this.jwtService.sign(payload),
    };
  }

  async loginAluno(dto: LoginDto) {
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

    const payload = { sub: aluno.id, role: 'ALUNO' };
    const { senha: _senha, ...result } = aluno;

    return {
      user: { ...result, role: 'ALUNO' },
      access_token: this.jwtService.sign(payload),
    };
  }
}
