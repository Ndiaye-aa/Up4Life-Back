import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizarTelefone } from '../../common/utils/telefone';
import { CreateAlunoDto } from './dto/create-aluno.dto';
import { UpdateAlunoDto } from './dto/update-aluno.dto';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';

// Alfabeto sem caracteres ambíguos (0/O, 1/l/I) para o aluno digitar sem erro.
const INITIAL_PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const INITIAL_PASSWORD_LENGTH = 8;

const generateInitialPassword = (): string =>
  Array.from(
    { length: INITIAL_PASSWORD_LENGTH },
    () =>
      INITIAL_PASSWORD_ALPHABET[randomInt(INITIAL_PASSWORD_ALPHABET.length)],
  ).join('');

@Injectable()
export class AlunosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAlunoDto, personalId: number) {
    const telefone = normalizarTelefone(dto.telefone);
    const existingAluno = await this.prisma.aluno.findUnique({
      where: { telefone },
    });

    if (existingAluno) {
      throw new ConflictException('Telefone já cadastrado.');
    }

    const initialPassword = dto.senha ?? generateInitialPassword();
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(initialPassword, salt);

    try {
      const aluno = await this.prisma.aluno.create({
        data: {
          nome: dto.nome,
          telefone,
          senha: hashedPassword,
          sexo: dto.sexo,
          nascimento: dto.nascimento,
          historicoSaude: dto.historicoSaude,
          personalId,
        },
      });

      const { senha: _senha, ...result } = aluno;
      // Devolvida uma única vez, apenas quando o servidor gerou a senha.
      return dto.senha ? result : { ...result, senhaInicial: initialPassword };
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

  async findAllByPersonal(personalId: number) {
    return this.prisma.aluno.findMany({
      where: { personalId },
      select: {
        id: true,
        nome: true,
        telefone: true,
        sexo: true,
        nascimento: true,
        ativo: true,
        criadoEm: true,
      },
    });
  }

  async findOne(id: number, personalId: number) {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id },
    });

    if (!aluno) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    if (aluno.personalId !== personalId) {
      throw new ForbiddenException('Acesso negado a este aluno.');
    }

    const { senha: _senha, ...result } = aluno;
    return result;
  }

  async update(id: number, dto: UpdateAlunoDto, personalId: number) {
    await this.findOne(id, personalId);
    return this.applyUpdate(id, dto);
  }

  async findSelf(id: number) {
    const aluno = await this.prisma.aluno.findUnique({ where: { id } });

    if (!aluno) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    const { senha: _senha, ...result } = aluno;
    return result;
  }

  async updateSelf(id: number, dto: UpdateAlunoDto) {
    const aluno = await this.prisma.aluno.findUnique({ where: { id } });

    if (!aluno) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    // Telefone e senha são as credenciais de login: exigir a senha atual impede
    // que um token vazado seja convertido em tomada definitiva da conta.
    if (dto.senha || dto.telefone) {
      if (!dto.senhaAtual) {
        throw new BadRequestException(
          'Informe a senha atual para alterar telefone ou senha.',
        );
      }

      const senhaConfere = await bcrypt.compare(dto.senhaAtual, aluno.senha);
      if (!senhaConfere) {
        throw new UnauthorizedException('Senha atual incorreta.');
      }
    }

    // Aluno não pode alterar o próprio status; apenas o personal via PATCH /alunos/:id
    return this.applyUpdate(id, { ...dto, ativo: undefined });
  }

  private async applyUpdate(id: number, dto: UpdateAlunoDto) {
    let hashedPassword: string | undefined = undefined;
    if (dto.senha) {
      const salt = await bcrypt.genSalt();
      hashedPassword = await bcrypt.hash(dto.senha, salt);
    }

    const telefone = dto.telefone
      ? normalizarTelefone(dto.telefone)
      : undefined;
    if (telefone) {
      const existingAluno = await this.prisma.aluno.findUnique({
        where: { telefone },
      });

      if (existingAluno && existingAluno.id !== id) {
        throw new ConflictException('Telefone já cadastrado.');
      }
    }

    try {
      const updatedAluno = await this.prisma.aluno.update({
        where: { id },
        data: {
          nome: dto.nome,
          telefone,
          senha: hashedPassword,
          sexo: dto.sexo,
          nascimento: dto.nascimento,
          historicoSaude: dto.historicoSaude,
          ativo: dto.ativo,
        },
      });

      const { senha: _senha, ...result } = updatedAluno;
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

  async remove(id: number, personalId: number) {
    await this.findOne(id, personalId);

    await this.prisma.aluno.delete({
      where: { id },
    });

    return { message: 'Aluno removido com sucesso.' };
  }
}
