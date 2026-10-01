import {
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OwnershipService } from '../../common/ownership/ownership.service';
import { CreateAgendamentoAvaliacaoDto } from './dto/create-agendamento-avaliacao.dto';
import { UpdateAgendamentoAvaliacaoDto } from './dto/update-agendamento-avaliacao.dto';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { ehHojeSp } from '../notificacoes/data-sp.util';

@Injectable()
export class AgendamentoAvaliacoesService {
  private readonly logger = new Logger(AgendamentoAvaliacoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
    private readonly ownership: OwnershipService,
  ) {}

  // O cron das 8:00 já passou quando um agendamento é criado/remarcado para o
  // próprio dia — nesse caso o lembrete "é hoje" sai na hora.
  private notificarSeAgendadoParaHoje(agendamento: {
    id: number;
    alunoId: number;
    personalId: number | null;
    dataAgendada: Date;
    status: string;
    lembreteDiaEm: Date | null;
    aluno?: { nome: string } | null;
  }) {
    if (
      agendamento.status !== 'PENDENTE' ||
      agendamento.lembreteDiaEm !== null ||
      !ehHojeSp(agendamento.dataAgendada)
    ) {
      return;
    }

    this.notificacoes
      .enviarLembreteAvaliacao(agendamento, 'DIA')
      .catch((error) =>
        this.logger.error(
          `Falha ao notificar agendamento ${agendamento.id}: ${String(error)}`,
        ),
      );
  }

  // Impede vincular avaliação alheia (o vínculo é @unique e desligaria o
  // agendamento original de outro personal via SetNull).
  private async validateAvaliacaoPertenceAoPersonal(
    avaliacaoId: number,
    personalId: number,
  ) {
    const avaliacao = await this.prisma.avaliacao.findUnique({
      where: { id: avaliacaoId },
      include: { aluno: { select: { personalId: true } } },
    });

    if (!avaliacao) {
      throw new NotFoundException('Avaliação não encontrada.');
    }

    const pertence =
      avaliacao.personalId === personalId ||
      avaliacao.aluno?.personalId === personalId;
    if (!pertence) {
      throw new ForbiddenException(
        'Você só pode vincular avaliações dos seus próprios alunos.',
      );
    }
  }

  async create(dto: CreateAgendamentoAvaliacaoDto, personalId: number) {
    await this.ownership.assertAlunoPertenceAoPersonal(
      dto.alunoId,
      personalId,
    );

    const agendamento = await this.prisma.agendamentoAvaliacao.create({
      data: {
        alunoId: dto.alunoId,
        personalId,
        dataAgendada: dto.dataAgendada,
      },
      include: {
        aluno: { select: { nome: true, sexo: true } },
      },
    });

    this.notificarSeAgendadoParaHoje(agendamento);

    return agendamento;
  }

  async findAllByPersonal(personalId: number) {
    return this.prisma.agendamentoAvaliacao.findMany({
      where: { personalId },
      include: {
        aluno: { select: { nome: true, sexo: true } },
      },
      orderBy: { dataAgendada: 'asc' },
    });
  }

  async update(
    id: number,
    dto: UpdateAgendamentoAvaliacaoDto,
    personalId: number,
  ) {
    const agendamento = await this.prisma.agendamentoAvaliacao.findUnique({
      where: { id },
    });

    if (!agendamento) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    if (agendamento.personalId !== personalId) {
      throw new ForbiddenException('Acesso negado.');
    }

    if (dto.alunoId !== undefined) {
      await this.ownership.assertAlunoPertenceAoPersonal(
        dto.alunoId,
        personalId,
      );
    }

    if (dto.avaliacaoId !== undefined) {
      await this.validateAvaliacaoPertenceAoPersonal(
        dto.avaliacaoId,
        personalId,
      );
    }

    const remarcado =
      dto.dataAgendada !== undefined &&
      dto.dataAgendada.getTime() !== agendamento.dataAgendada.getTime();

    let atualizado;
    try {
      atualizado = await this.prisma.agendamentoAvaliacao.update({
        where: { id },
        data: {
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.avaliacaoId !== undefined && {
            avaliacaoId: dto.avaliacaoId,
          }),
          ...(dto.dataAgendada !== undefined && {
            dataAgendada: dto.dataAgendada,
          }),
          ...(dto.alunoId !== undefined && { alunoId: dto.alunoId }),
          ...(remarcado && { lembreteVesperaEm: null, lembreteDiaEm: null }),
        },
        include: {
          aluno: { select: { nome: true, sexo: true } },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Esta avaliação já está vinculada a outro agendamento.',
        );
      }
      throw error;
    }

    if (remarcado) {
      this.notificarSeAgendadoParaHoje(atualizado);
    }

    return atualizado;
  }

  async remove(id: number, personalId: number) {
    const agendamento = await this.prisma.agendamentoAvaliacao.findUnique({
      where: { id },
    });

    if (!agendamento) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    if (agendamento.personalId !== personalId) {
      throw new ForbiddenException('Acesso negado.');
    }

    await this.prisma.agendamentoAvaliacao.delete({
      where: { id },
    });

    return { message: 'Agendamento removido com sucesso.' };
  }
}
