import { Module } from '@nestjs/common';
import { FaltasModule } from '../faltas/faltas.module';
import { SessoesTreinoController } from './sessoes-treino.controller';
import { SessoesTreinoService } from './sessoes-treino.service';

@Module({
  imports: [FaltasModule],
  controllers: [SessoesTreinoController],
  providers: [SessoesTreinoService],
  exports: [SessoesTreinoService],
})
export class SessoesTreinoModule {}
