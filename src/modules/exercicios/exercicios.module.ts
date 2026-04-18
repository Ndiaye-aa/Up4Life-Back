import { Module } from '@nestjs/common';
import { ExerciciosService } from './exercicios.service';
import { ExerciciosController } from './exercicios.controller';

@Module({
  providers: [ExerciciosService],
  controllers: [ExerciciosController],
})
export class ExerciciosModule {}
