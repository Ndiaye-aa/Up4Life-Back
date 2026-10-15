import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateExercicioDto } from './dto/create-exercicio.dto';
import { UpdateExercicioDto } from './dto/update-exercicio.dto';

@Injectable()
export class ExerciciosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateExercicioDto) {
    try {
      return await this.prisma.exercicio.create({
        data: {
          nome: dto.nome,
          grupoMuscular: dto.grupoMuscular,
          descricao: dto.descricao,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um exercício com esse nome.');
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateExercicioDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const atual = await tx.exercicio.findUnique({ where: { id } });
        if (!atual) {
          throw new NotFoundException('Exercício não encontrado.');
        }
        const atualizado = await tx.exercicio.update({
          where: { id },
          data: dto,
        });
        // Itens de treino guardam o nome (sem FK): acompanha a renomeação.
        if (dto.nome && dto.nome !== atual.nome) {
          await tx.itemTreino.updateMany({
            where: { exercicio: atual.nome, treino: { tipo: 'EXERCICIOS' } },
            data: { exercicio: dto.nome },
          });
        }
        return atualizado;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um exercício com esse nome.');
      }
      throw error;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.exercicio.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Exercício não encontrado.');
      }
      throw error;
    }
    return { id, removido: true };
  }

  async findAll() {
    return this.prisma.exercicio.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async findByGrupo(grupoMuscular: string) {
    return this.prisma.exercicio.findMany({
      where: { grupoMuscular },
      orderBy: { nome: 'asc' },
    });
  }

  async listFavoritos(personalId: number) {
    const favoritos = await this.prisma.exercicioFavorito.findMany({
      where: { personalId },
      select: { exercicioId: true },
    });
    return favoritos.map((f) => f.exercicioId);
  }

  async favoritar(exercicioId: number, personalId: number) {
    const exercicio = await this.prisma.exercicio.findUnique({
      where: { id: exercicioId },
      select: { id: true },
    });
    if (!exercicio) {
      throw new NotFoundException('Exercício não encontrado.');
    }

    await this.prisma.exercicioFavorito.upsert({
      where: { personalId_exercicioId: { personalId, exercicioId } },
      create: { personalId, exercicioId },
      update: {},
    });
    return { exercicioId, favorito: true };
  }

  async desfavoritar(exercicioId: number, personalId: number) {
    await this.prisma.exercicioFavorito.deleteMany({
      where: { personalId, exercicioId },
    });
    return { exercicioId, favorito: false };
  }
}
