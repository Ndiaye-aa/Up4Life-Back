import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  async assertAlunoPertenceAoPersonal(alunoId: number, personalId: number) {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: alunoId },
    });

    if (!aluno) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    if (aluno.personalId !== personalId) {
      throw new ForbiddenException(
        'Você só pode operar sobre seus próprios alunos.',
      );
    }
  }

  async assertTreinoPertenceAoPersonal(treinoId: number, personalId: number) {
    const treino = await this.prisma.treino.findUnique({
      where: { id: treinoId },
      select: {
        id: true,
        personalId: true,
        alunoId: true,
        aluno: { select: { personalId: true } },
      },
    });

    if (!treino) {
      throw new NotFoundException('Treino não encontrado.');
    }

    const hasAccess =
      treino.personalId === personalId ||
      treino.aluno?.personalId === personalId;
    if (!hasAccess) {
      throw new ForbiddenException('Acesso negado.');
    }

    return treino;
  }
}
