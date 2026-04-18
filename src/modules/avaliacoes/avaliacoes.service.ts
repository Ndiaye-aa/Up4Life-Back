import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAvaliacaoDto } from './dto/create-avaliacao.dto';
import { calculateIMC, calculateIAC } from '../../common/calculations/indices';
import { calculatePollock7Folds } from '../../common/calculations/body-composition';

@Injectable()
export class AvaliacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAvaliacaoDto, personalId: number) {
    // 1. Validar aluno
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: dto.alunoId },
    });

    if (!aluno) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    if (aluno.personalId !== personalId) {
      throw new ForbiddenException('Acesso negado.');
    }

    // 2. Executar cálculos para persistência
    const imc = calculateIMC(dto.peso, dto.altura);
    const iac = dto.quadril ? calculateIAC(dto.quadril, dto.altura) : null;

    let pollockResult: { densidade: number; percentualGordura: number } | null = null;
    if (
      dto.peitoral &&
      dto.axilarMedia &&
      dto.triceps &&
      dto.subescapular &&
      dto.abdominal &&
      dto.supraIliaca &&
      dto.coxa
    ) {
      pollockResult = calculatePollock7Folds(
        dto.idade,
        dto.peitoral,
        dto.axilarMedia,
        dto.triceps,
        dto.subescapular,
        dto.abdominal,
        dto.supraIliaca,
        dto.coxa,
      );
    }

    const clamp = (v: number | null, max: number): number | null =>
      v !== null && Math.abs(v) > max ? null : v;

    // 3. Persistir medidas e resultados
    return this.prisma.avaliacao.create({
      data: {
        ...dto,
        imc: clamp(imc, 999.99),
        iac: clamp(iac, 999.99),
        densidadeCorporal: clamp(pollockResult?.densidade ?? null, 99.9999),
        percentualGordura: clamp(pollockResult?.percentualGordura ?? null, 999.99),
      },
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

    return this.prisma.avaliacao.findMany({
      where: { alunoId },
      orderBy: { dataAvaliacao: 'desc' },
    });
  }
}
