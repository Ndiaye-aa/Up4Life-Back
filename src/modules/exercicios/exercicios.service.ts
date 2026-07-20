import { Injectable, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateExercicioDto } from './dto/create-exercicio.dto';

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
}
