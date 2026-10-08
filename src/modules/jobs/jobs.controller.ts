import { Controller, HttpCode, Logger, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JobSecretGuard } from '../../common/jobs/job-secret.guard';
import { Public } from '../auth/decorators/public.decorator';
import { SkipCsrf } from '../auth/decorators/skip-csrf.decorator';
import { FaltasService } from '../faltas/faltas.service';
import { LembretesScheduler } from '../notificacoes/lembretes.scheduler';

/**
 * Gatilhos externos dos jobs. Respondem 202 de imediato: o processamento
 * continua na instância e o timeout curto do serviço de cron não derruba a
 * chamada durante um cold start.
 */
@Controller('internal/jobs')
@Public()
@SkipCsrf()
@SkipThrottle()
@UseGuards(JobSecretGuard)
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(
    private readonly faltas: FaltasService,
    private readonly lembretes: LembretesScheduler,
  ) {}

  @Post('fechamento-faltas')
  @HttpCode(202)
  fechamentoFaltas() {
    void this.faltas
      .executar()
      .catch((e) => this.logger.error(`fechamento-faltas: ${String(e)}`));
    return { aceito: true };
  }

  @Post('lembretes-avaliacao')
  @HttpCode(202)
  lembretesAvaliacao() {
    void this.lembretes
      .executar()
      .catch((e) => this.logger.error(`lembretes-avaliacao: ${String(e)}`));
    return { aceito: true };
  }
}
