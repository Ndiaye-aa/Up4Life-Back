import { Module } from '@nestjs/common';
import { AgendamentoAvaliacoesController } from './agendamento-avaliacoes.controller';
import { AgendamentoAvaliacoesService } from './agendamento-avaliacoes.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [NotificacoesModule],
  controllers: [AgendamentoAvaliacoesController],
  providers: [AgendamentoAvaliacoesService],
})
export class AgendamentoAvaliacoesModule {}
