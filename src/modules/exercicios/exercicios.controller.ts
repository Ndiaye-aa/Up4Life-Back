import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ExerciciosService } from './exercicios.service';
import { CreateExercicioDto } from './dto/create-exercicio.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('exercicios')
export class ExerciciosController {
  constructor(private readonly exerciciosService: ExerciciosService) {}

  @Post()
  @Roles('PERSONAL')
  create(@Body() dto: CreateExercicioDto) {
    return this.exerciciosService.create(dto);
  }

  @Get()
  findAll(@Query('grupoMuscular') grupoMuscular?: string) {
    if (grupoMuscular) {
      return this.exerciciosService.findByGrupo(grupoMuscular);
    }
    return this.exerciciosService.findAll();
  }
}
