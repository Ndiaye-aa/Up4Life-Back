import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Query,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ExerciciosService } from './exercicios.service';
import { CreateExercicioDto } from './dto/create-exercicio.dto';
import { UpdateExercicioDto } from './dto/update-exercicio.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';

@Controller('exercicios')
export class ExerciciosController {
  constructor(private readonly exerciciosService: ExerciciosService) {}

  @Post()
  @Roles('PERSONAL')
  create(@Body() dto: CreateExercicioDto) {
    return this.exerciciosService.create(dto);
  }

  // Declarado antes de qualquer rota com :id para não colidir
  @Get('favoritos')
  @Roles('PERSONAL')
  listFavoritos(@User('id') personalId: number) {
    return this.exerciciosService.listFavoritos(personalId);
  }

  @Put(':id/favorito')
  @Roles('PERSONAL')
  favoritar(
    @Param('id', ParseIntPipe) id: number,
    @User('id') personalId: number,
  ) {
    return this.exerciciosService.favoritar(id, personalId);
  }

  @Delete(':id/favorito')
  @Roles('PERSONAL')
  desfavoritar(
    @Param('id', ParseIntPipe) id: number,
    @User('id') personalId: number,
  ) {
    return this.exerciciosService.desfavoritar(id, personalId);
  }

  @Get()
  @Roles('PERSONAL', 'ALUNO')
  findAll(@Query('grupoMuscular') grupoMuscular?: string) {
    if (grupoMuscular) {
      return this.exerciciosService.findByGrupo(grupoMuscular);
    }
    return this.exerciciosService.findAll();
  }

  @Patch(':id')
  @Roles('PERSONAL')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExercicioDto,
  ) {
    return this.exerciciosService.update(id, dto);
  }

  @Delete(':id')
  @Roles('PERSONAL')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.exerciciosService.remove(id);
  }
}
