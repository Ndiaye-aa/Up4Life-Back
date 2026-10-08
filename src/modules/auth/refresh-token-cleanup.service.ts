import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobLockService } from '../../common/jobs/job-lock.service';
import { PrismaService } from '../../common/prisma/prisma.service';

// Tokens revogados ficam um tempo para a detecção de reuso (roubo) funcionar.
const RETENCAO_DIAS = 7;

@Injectable()
export class RefreshTokenCleanupService {
  private readonly logger = new Logger(RefreshTokenCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lock: JobLockService,
  ) {}

  @Cron('0 4 * * *', { timeZone: 'America/Sao_Paulo' })
  async agendado() {
    await this.limpar().catch((error) =>
      this.logger.error(`limpeza-refresh-tokens: ${String(error)}`),
    );
  }

  /** Remove tokens expirados ou revogados há mais de 7 dias. Retorna quantos. */
  async limpar(agora = new Date()): Promise<number> {
    if (!(await this.lock.adquirir('limpeza-refresh-tokens'))) return 0;

    let removidos = 0;
    try {
      const corte = new Date(agora.getTime() - RETENCAO_DIAS * 86_400_000);
      const { count } = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: corte } }, { revokedAt: { lt: corte } }],
        },
      });
      removidos = count;
      return removidos;
    } finally {
      await this.lock.liberar('limpeza-refresh-tokens', { removidos });
    }
  }
}
