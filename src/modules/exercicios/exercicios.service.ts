import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ExerciciosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(nome: string, grupoMuscular: string) {
    return this.prisma.exercicio.create({
      data: { nome, grupoMuscular },
    });
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
