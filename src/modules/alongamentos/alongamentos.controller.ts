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
import { AlongamentosService } from './alongamentos.service';
import { CreateAlongamentoDto } from './dto/create-alongamento.dto';
import { UpdateAlongamentoDto } from './dto/update-alongamento.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';

@Controller('alongamentos')
export class AlongamentosController {
  constructor(private readonly alongamentosService: AlongamentosService) {}

  @Post()
  @Roles('PERSONAL')
  create(@Body() dto: CreateAlongamentoDto) {
    return this.alongamentosService.create(dto);
  }

  // Declarado antes de qualquer rota com :id para não colidir
  @Get('favoritos')
  @Roles('PERSONAL')
  listFavoritos(@User('id') personalId: number) {
    return this.alongamentosService.listFavoritos(personalId);
  }

  @Put(':id/favorito')
  @Roles('PERSONAL')
  favoritar(
    @Param('id', ParseIntPipe) id: number,
    @User('id') personalId: number,
  ) {
    return this.alongamentosService.favoritar(id, personalId);
  }

  @Delete(':id/favorito')
  @Roles('PERSONAL')
  desfavoritar(
    @Param('id', ParseIntPipe) id: number,
    @User('id') personalId: number,
  ) {
    return this.alongamentosService.desfavoritar(id, personalId);
  }

  @Get()
  @Roles('PERSONAL', 'ALUNO')
  findAll(@Query('grupoMuscular') grupoMuscular?: string) {
    if (grupoMuscular) {
      return this.alongamentosService.findByGrupo(grupoMuscular);
    }
    return this.alongamentosService.findAll();
  }

  @Patch(':id')
  @Roles('PERSONAL')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAlongamentoDto,
  ) {
    return this.alongamentosService.update(id, dto);
  }

  @Delete(':id')
  @Roles('PERSONAL')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.alongamentosService.remove(id);
  }
}
