import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JobLockService } from '../../common/jobs/job-lock.service';
import { NotificacoesService, TipoLembrete } from './notificacoes.service';
import { inicioDoDiaSp } from './data-sp.util';

@Injectable()
export class LembretesScheduler {
  private readonly logger = new Logger(LembretesScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
    private readonly lock: JobLockService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'America/Sao_Paulo' })
  async enviarLembretesDiarios() {
    await this.executar().catch((error) =>
      this.logger.error(`lembretes-avaliacao: ${String(error)}`),
    );
  }

  /**
   * Chamado pelo @Cron interno, pelo cron-job.org e pelo backup do GitHub
   * Actions. Idempotente: o lock evita execuções simultâneas e os campos
   * lembrete*Em evitam reenvio.
   */
  async executar(): Promise<
    { hoje: number; vespera: number } | { ignorado: string }
  > {
    if (!(await this.lock.adquirir('lembretes-avaliacao'))) {
      return { ignorado: 'em-execucao' };
    }

    let resultado: { hoje: number; vespera: number } = { hoje: 0, vespera: 0 };
    try {
      resultado = await this.enviarLembretes();
      return resultado;
    } finally {
      await this.lock.liberar('lembretes-avaliacao', resultado);
    }
  }

  private async enviarLembretes() {
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

    return {
      hoje: agendamentosDeHoje.length,
      vespera: agendamentosDeAmanha.length,
    };
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
