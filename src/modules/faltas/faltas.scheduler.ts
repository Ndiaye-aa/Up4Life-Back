import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FaltasService } from './faltas.service';

@Injectable()
export class FaltasScheduler {
  private readonly logger = new Logger(FaltasScheduler.name);

  constructor(private readonly faltas: FaltasService) {}

  // Atua quando a instância já está acordada; os gatilhos externos cobrem o resto.
  @Cron('30 8 * * *', { timeZone: 'America/Sao_Paulo' })
  async fecharDia() {
    await this.faltas
      .executar()
      .catch((e) => this.logger.error(`fechamento-faltas: ${String(e)}`));
  }
}
