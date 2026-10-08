import { Module } from '@nestjs/common';
import { ProgressoModule } from '../progresso/progresso.module';
import { AlunosController } from './alunos.controller';
import { AlunosService } from './alunos.service';

@Module({
  imports: [ProgressoModule],
  controllers: [AlunosController],
  providers: [AlunosService],
})
export class AlunosModule {}
