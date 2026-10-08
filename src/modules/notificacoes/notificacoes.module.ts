import { Module } from '@nestjs/common';
import { JobLockModule } from '../../common/jobs/job-lock.module';
import { NotificacoesController } from './notificacoes.controller';
import { NotificacoesService } from './notificacoes.service';
import { LembretesScheduler } from './lembretes.scheduler';

@Module({
  imports: [JobLockModule],
  controllers: [NotificacoesController],
  providers: [NotificacoesService, LembretesScheduler],
  exports: [NotificacoesService, LembretesScheduler],
})
export class NotificacoesModule {}
