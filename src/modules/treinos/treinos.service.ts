import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTreinoDto } from './dto/create-treino.dto';
import { UpdateTreinoDto } from './dto/update-treino.dto';
import { CreateItemTreinoDto } from './dto/create-item-treino.dto';

@Injectable()
export class TreinosService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateAlunoPertenceAoPersonal(
    alunoId: number,
    personalId: number,
  ) {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: alunoId },
    });

    if (!aluno) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    if (aluno.personalId !== personalId) {
      throw new ForbiddenException(
        'Você só pode prescrever treinos para seus próprios alunos.',
      );
    }
  }

  private async validateItens(itens: CreateItemTreinoDto[]) {
    // 1. Validar duplicidade de ordem nos itens
    const ordens = itens.map((i) => i.ordem);
    const hasDuplicateOrdem = ordens.some(
      (ordem, index) => ordens.indexOf(ordem) !== index,
    );

    if (hasDuplicateOrdem) {
      throw new BadRequestException(
        'Um treino não pode ter dois exercícios com a mesma ordem.',
      );
    }

    // 2. Validar se os exercícios existem no catálogo
    const nomesExercicios = itens.map((i) => i.exercicio);
    const catalogCount = await this.prisma.exercicio.count({
      where: {
        nome: { in: nomesExercicios },
      },
    });

    if (catalogCount < [...new Set(nomesExercicios)].length) {
      throw new BadRequestException(
        'Um ou mais exercícios não foram encontrados no catálogo.',
      );
    }
  }

  private async resolveOwner(
    dto: { paraMim?: boolean; alunoId?: number },
    personalId: number,
  ) {
    if (dto.paraMim && dto.alunoId != null) {
      throw new BadRequestException(
        'Informe alunoId ou paraMim, nunca os dois.',
      );
    }

    // paraMim: o vínculo é sempre com o personal autenticado (JWT) — nunca com outro personal
    if (dto.paraMim) {
      return { alunoId: null, personalId };
    }

    await this.validateAlunoPertenceAoPersonal(dto.alunoId!, personalId);
    return { alunoId: dto.alunoId!, personalId: null };
  }

  async create(dto: CreateTreinoDto, personalId: number) {
    const owner = await this.resolveOwner(dto, personalId);
    await this.validateItens(dto.itens);

    // Persistir treino e itens em uma transação explícita
    return this.prisma.$transaction(async (tx) => {
      const treino = await tx.treino.create({
        data: {
          alunoId: owner.alunoId,
          personalId: owner.personalId,
          objetivo: dto.objetivo,
          observacoes: dto.observacoes,
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
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: alunoId },
    });
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
        ? treino.personalId === userId || treino.aluno?.personalId === userId
        : treino.alunoId === userId;
    if (!hasAccess) {
      throw new ForbiddenException('Acesso negado.');
    }

    return treino;
  }

  async findAllByPersonal(personalId: number) {
    return this.prisma.treino.findMany({
      where: { OR: [{ aluno: { personalId } }, { personalId }] },
      include: {
        aluno: { select: { nome: true, personalId: true } },
        personal: { select: { nome: true } },
        itens: { orderBy: { ordem: 'asc' } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async findMeuTreino(alunoId: number) {
    return this.prisma.treino.findMany({
      where: { alunoId },
      include: {
        itens: { orderBy: { ordem: 'asc' } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async update(id: number, dto: UpdateTreinoDto, personalId: number) {
    // 1. Garante que o treino existe e pertence a este personal (direto ou via aluno)
    await this.findOne(id, personalId, 'PERSONAL');

    // 2. Resolve o dono de destino (aluno do personal ou o próprio personal)
    const owner = await this.resolveOwner(dto, personalId);

    await this.validateItens(dto.itens);

    // 3. Substitui os itens por completo (payload sempre vem com a lista inteira)
    return this.prisma.$transaction(async (tx) => {
      await tx.itemTreino.deleteMany({ where: { treinoId: id } });

      return tx.treino.update({
        where: { id },
        data: {
          alunoId: owner.alunoId,
          personalId: owner.personalId,
          objetivo: dto.objetivo,
          observacoes: dto.observacoes,
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
    });
  }

  async remove(id: number, personalId: number) {
    await this.findOne(id, personalId, 'PERSONAL');
    return this.prisma.treino.delete({ where: { id } });
  }
}
