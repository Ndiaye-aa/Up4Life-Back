import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ExerciciosService } from './exercicios.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('exercicios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExerciciosController {
  constructor(private readonly exerciciosService: ExerciciosService) {}

  @Post()
  @Roles('PERSONAL')
  create(@Body('nome') nome: string, @Body('grupoMuscular') grupoMuscular: string) {
    return this.exerciciosService.create(nome, grupoMuscular);
  }

  @Get()
  findAll(@Query('grupoMuscular') grupoMuscular?: string) {
    if (grupoMuscular) {
      return this.exerciciosService.findByGrupo(grupoMuscular);
    }
    return this.exerciciosService.findAll();
  }
}
