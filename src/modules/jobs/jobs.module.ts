import { Module } from '@nestjs/common';
import { FaltasModule } from '../faltas/faltas.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { JobsController } from './jobs.controller';

@Module({
  imports: [FaltasModule, NotificacoesModule],
  controllers: [JobsController],
})
export class JobsModule {}
