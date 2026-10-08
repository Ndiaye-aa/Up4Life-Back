import { Module } from '@nestjs/common';
import { ProgressoService } from './progresso.service';

// As rotas HTTP de progresso vivem no AlunosController (`/alunos/...`).
@Module({
  providers: [ProgressoService],
  exports: [ProgressoService],
})
export class ProgressoModule {}
