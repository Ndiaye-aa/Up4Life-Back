import { Module } from '@nestjs/common';
import { NotificacoesController } from './notificacoes.controller';
import { NotificacoesService } from './notificacoes.service';
import { LembretesScheduler } from './lembretes.scheduler';

@Module({
  controllers: [NotificacoesController],
  providers: [NotificacoesService, LembretesScheduler],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
