import { Module } from '@nestjs/common';
import { JobLockModule } from '../../common/jobs/job-lock.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { FaltasScheduler } from './faltas.scheduler';
import { FaltasService } from './faltas.service';

@Module({
  imports: [JobLockModule, NotificacoesModule],
  providers: [FaltasService, FaltasScheduler],
  exports: [FaltasService],
})
export class FaltasModule {}
