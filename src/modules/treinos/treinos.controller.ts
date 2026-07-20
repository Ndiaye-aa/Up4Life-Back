import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { TreinosService } from './treinos.service';
import { CreateTreinoDto } from './dto/create-treino.dto';
import { UpdateTreinoDto } from './dto/update-treino.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';

@Controller('treinos')
export class TreinosController {
  constructor(private readonly treinosService: TreinosService) {}

  @Post()
  @Roles('PERSONAL')
  create(@Body() dto: CreateTreinoDto, @User('id') personalId: number) {
    return this.treinosService.create(dto, personalId);
  }

  @Get()
  @Roles('PERSONAL')
  findAllByPersonal(@User('id') personalId: number) {
    return this.treinosService.findAllByPersonal(personalId);
  }

  @Get('meu-treino')
  @Roles('ALUNO')
  findMeuTreino(@User('id') alunoId: number) {
    return this.treinosService.findMeuTreino(alunoId);
  }

  @Get('aluno/:alunoId')
  @Roles('PERSONAL', 'ALUNO')
  findAll(
    @Param('alunoId', ParseIntPipe) alunoId: number,
    @User() user: { id: number; role: string },
  ) {
    return this.treinosService.findAllByAluno(alunoId, user.id, user.role);
  }

  @Get(':id')
  @Roles('PERSONAL', 'ALUNO')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @User() user: { id: number; role: string },
  ) {
    return this.treinosService.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  @Roles('PERSONAL')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTreinoDto,
    @User('id') personalId: number,
  ) {
    return this.treinosService.update(id, dto, personalId);
  }

  @Delete(':id')
  @Roles('PERSONAL')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @User('id') personalId: number,
  ) {
    return this.treinosService.remove(id, personalId);
  }
}
