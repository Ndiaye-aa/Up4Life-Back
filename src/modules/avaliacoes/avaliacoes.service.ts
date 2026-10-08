import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { LIMITE_LISTAGEM } from '../../common/config/limites';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAvaliacaoDto } from './dto/create-avaliacao.dto';
import { calculateIMC, calculateIAC } from '../../common/calculations/indices';
import {
  calculatePollock7FoldsMale,
  calculatePollock7FoldsFemale,
} from '../../common/calculations/body-composition';

@Injectable()
export class AvaliacoesService {
  private readonly logger = new Logger(AvaliacoesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAvaliacaoDto, personalId: number) {
    const { alunoId, paraMim, sexo, ...medidas } = dto;

    if (paraMim && alunoId != null) {
      throw new BadRequestException(
        'Informe alunoId ou paraMim, nunca os dois.',
      );
    }

    // 1. Resolver o dono: aluno do personal ou o próprio personal (autoavaliação via JWT)
    let sexoRef: string | null;
    if (paraMim) {
      sexoRef = sexo ?? null;
    } else {
      const aluno = await this.prisma.aluno.findUnique({
        where: { id: alunoId },
      });

      if (!aluno) {
        throw new NotFoundException('Aluno não encontrado.');
      }

      if (aluno.personalId !== personalId) {
        throw new ForbiddenException('Acesso negado.');
      }

      sexoRef = aluno.sexo;
    }

    // 2. Executar cálculos para persistência
    const imc = calculateIMC(dto.peso, dto.altura);
    const iac = dto.quadril ? calculateIAC(dto.quadril, dto.altura) : null;

    let pollockResult: { densidade: number; percentualGordura: number } | null =
      null;
    if (
      dto.peitoral &&
      dto.axilarMedia &&
      dto.triceps &&
      dto.subescapular &&
      dto.abdominal &&
      dto.supraIliaca &&
      dto.coxa
    ) {
      const calculatePollock7Folds =
        sexoRef === 'F'
          ? calculatePollock7FoldsFemale
          : calculatePollock7FoldsMale;

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

    const donoRef = paraMim ? `personal ${personalId}` : `aluno ${alunoId}`;
    const clamp = (
      label: string,
      v: number | null,
      max: number,
    ): number | null => {
      if (v !== null && Math.abs(v) > max) {
        this.logger.warn(
          `${label} calculado fora da faixa esperada (${v}) para ${donoRef} — descartado como null. Verifique os dados de entrada (ex.: altura em cm em vez de metros).`,
        );
        return null;
      }
      return v;
    };

    // 3. Persistir medidas e resultados
    return this.prisma.avaliacao.create({
      data: {
        ...medidas,
        alunoId: paraMim ? null : alunoId,
        personalId: paraMim ? personalId : null,
        imc: clamp('IMC', imc, 999.99),
        iac: clamp('IAC', iac, 999.99),
        densidadeCorporal: clamp(
          'Densidade corporal',
          pollockResult?.densidade ?? null,
          99.9999,
        ),
        percentualGordura: clamp(
          '% de gordura',
          pollockResult?.percentualGordura ?? null,
          999.99,
        ),
      },
    });
  }

  async findAllByPersonal(personalId: number) {
    // select enxuto: esta listagem alimenta dashboards/telas de overview que não
    // consomem anamnese nem dobras cutâneas cruas (ver findAllByAluno para o
    // registro completo, usado na tela de resultados/anamnese por aluno).
    const avaliacoes = await this.prisma.avaliacao.findMany({
      where: { OR: [{ aluno: { personalId } }, { personalId }] },
      orderBy: { dataAvaliacao: 'desc' },
      take: LIMITE_LISTAGEM,
      select: {
        id: true,
        alunoId: true,
        peso: true,
        altura: true,
        idade: true,
        cintura: true,
        quadril: true,
        peitoral: true,
        coxa: true,
        abdominal: true,
        imc: true,
        iac: true,
        percentualGordura: true,
        dataAvaliacao: true,
      },
    });
    if (avaliacoes.length === LIMITE_LISTAGEM) {
      this.logger.warn(
        `Listagem de avaliações do personal ${personalId} atingiu o teto de ${LIMITE_LISTAGEM}; implemente paginação.`,
      );
    }
    return avaliacoes;
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

    return this.prisma.avaliacao.findMany({
      where: { alunoId },
      orderBy: { dataAvaliacao: 'desc' },
    });
  }
}
