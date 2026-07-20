import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificacoesService, TipoLembrete } from './notificacoes.service';
import { inicioDoDiaSp } from './data-sp.util';

@Injectable()
export class LembretesScheduler {
  private readonly logger = new Logger(LembretesScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'America/Sao_Paulo' })
  async enviarLembretesDiarios() {
    const hoje = inicioDoDiaSp(0);
    const amanha = inicioDoDiaSp(1);
    const depoisDeAmanha = inicioDoDiaSp(2);

    const [agendamentosDeHoje, agendamentosDeAmanha] = await Promise.all([
      this.prisma.agendamentoAvaliacao.findMany({
        where: {
          status: 'PENDENTE',
          lembreteDiaEm: null,
          dataAgendada: { gte: hoje, lt: amanha },
        },
        include: { aluno: { select: { nome: true } } },
      }),
      this.prisma.agendamentoAvaliacao.findMany({
        where: {
          status: 'PENDENTE',
          lembreteVesperaEm: null,
          dataAgendada: { gte: amanha, lt: depoisDeAmanha },
        },
        include: { aluno: { select: { nome: true } } },
      }),
    ]);

    await this.processar(agendamentosDeHoje, 'DIA');
    await this.processar(agendamentosDeAmanha, 'VESPERA');

    if (agendamentosDeHoje.length > 0 || agendamentosDeAmanha.length > 0) {
      this.logger.log(
        `Lembretes enviados: ${agendamentosDeHoje.length} de hoje, ${agendamentosDeAmanha.length} de véspera.`,
      );
    }
  }

  private async processar(
    agendamentos: {
      id: number;
      alunoId: number;
      personalId: number | null;
      dataAgendada: Date;
      aluno?: { nome: string } | null;
    }[],
    tipo: TipoLembrete,
  ) {
    for (const agendamento of agendamentos) {
      try {
        await this.notificacoes.enviarLembreteAvaliacao(agendamento, tipo);
      } catch (error) {
        this.logger.error(
          `Falha no lembrete ${tipo} do agendamento ${agendamento.id}: ${String(error)}`,
        );
      }
    }
  }
}
