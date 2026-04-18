import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAlunoDto } from './dto/create-aluno.dto';
import { UpdateAlunoDto } from './dto/update-aluno.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AlunosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAlunoDto, personalId: number) {
    const existingAluno = await this.prisma.aluno.findUnique({
      where: { telefone: dto.telefone },
    });

    if (existingAluno) {
      throw new ConflictException('Telefone já cadastrado.');
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(dto.senha, salt);

    const aluno = await this.prisma.aluno.create({
      data: {
        nome: dto.nome,
        telefone: dto.telefone,
        senha: hashedPassword,
        sexo: dto.sexo,
        nascimento: dto.nascimento,
        historicoSaude: dto.historicoSaude,
        personalId,
      },
    });

    const { senha, ...result } = aluno;
    return result;
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

    const { senha, ...result } = aluno;
    return result;
  }

  async update(id: number, dto: UpdateAlunoDto, personalId: number) {
    const aluno = await this.findOne(id, personalId);

    let hashedPassword: string | undefined = undefined;
    if (dto.senha) {
      const salt = await bcrypt.genSalt();
      hashedPassword = await bcrypt.hash(dto.senha, salt);
    }

    const updatedAluno = await this.prisma.aluno.update({
      where: { id },
      data: {
        nome: dto.nome,
        telefone: dto.telefone,
        senha: hashedPassword,
        sexo: dto.sexo,
        nascimento: dto.nascimento,
        historicoSaude: dto.historicoSaude,
      },
    });

    const { senha, ...result } = updatedAluno;
    return result;
  }

  async remove(id: number, personalId: number) {
    await this.findOne(id, personalId);
    
    await this.prisma.aluno.delete({
      where: { id },
    });

    return { message: 'Aluno removido com sucesso.' };
  }
}
