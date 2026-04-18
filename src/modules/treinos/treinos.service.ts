import { Injectable, ForbiddenException, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTreinoDto } from './dto/create-treino.dto';

@Injectable()
export class TreinosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTreinoDto, personalId: number) {
    // 1. Validar se o aluno pertence ao Personal logado
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: dto.alunoId },
    });

    if (!aluno) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    if (aluno.personalId !== personalId) {
      throw new ForbiddenException('Você só pode prescrever treinos para seus próprios alunos.');
    }

    // 2. Validar duplicidade de ordem nos itens
    const ordens = dto.itens.map((i) => i.ordem);
    const hasDuplicateOrdem = ordens.some((ordem, index) => ordens.indexOf(ordem) !== index);

    if (hasDuplicateOrdem) {
      throw new BadRequestException('Um treino não pode ter dois exercícios com a mesma ordem.');
    }

    // 3. Validar se os exercícios existem no catálogo
    const nomesExercicios = dto.itens.map((i) => i.exercicio);
    const catalogCount = await this.prisma.exercicio.count({
      where: {
        nome: { in: nomesExercicios },
      },
    });

    if (catalogCount < [...new Set(nomesExercicios)].length) {
      throw new BadRequestException('Um ou mais exercícios não foram encontrados no catálogo.');
    }

    // 4. Persistir treino e itens em uma transação explícita
    return this.prisma.$transaction(async (tx) => {
      const treino = await tx.treino.create({
        data: {
          alunoId: dto.alunoId,
          objetivo: dto.objetivo,
          dataValidade: dto.dataValidade,
          itens: {
            create: dto.itens,
          },
        },
        include: {
          itens: {
            orderBy: {
              ordem: 'asc',
            },
          },
        },
      });

      return treino;
    });
  }

  async findAllByAluno(alunoId: number, userId: number, role: string) {
    const aluno = await this.prisma.aluno.findUnique({ where: { id: alunoId } });
    if (!aluno) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    const hasAccess =
      role === 'PERSONAL' ? aluno.personalId === userId : aluno.id === userId;
    if (!hasAccess) {
      throw new ForbiddenException('Acesso negado.');
    }

    return this.prisma.treino.findMany({
      where: { alunoId },
      include: {
        itens: {
          orderBy: { ordem: 'asc' },
        },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async findOne(id: number, userId: number, role: string) {
    const treino = await this.prisma.treino.findUnique({
      where: { id },
      include: {
        aluno: true,
        itens: {
          orderBy: { ordem: 'asc' },
        },
      },
    });

    if (!treino) {
      throw new NotFoundException('Treino não encontrado.');
    }

    const hasAccess =
      role === 'PERSONAL'
        ? treino.aluno.personalId === userId
        : treino.alunoId === userId;
    if (!hasAccess) {
      throw new ForbiddenException('Acesso negado.');
    }

    return treino;
  }

  async remove(id: number, personalId: number) {
    await this.findOne(id, personalId, 'PERSONAL');
    return this.prisma.treino.delete({ where: { id } });
  }
}
