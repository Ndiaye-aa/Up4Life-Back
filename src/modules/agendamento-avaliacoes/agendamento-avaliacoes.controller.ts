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
import { AgendamentoAvaliacoesService } from './agendamento-avaliacoes.service';
import { CreateAgendamentoAvaliacaoDto } from './dto/create-agendamento-avaliacao.dto';
import { UpdateAgendamentoAvaliacaoDto } from './dto/update-agendamento-avaliacao.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';

@Controller('agendamentos-avaliacao')
export class AgendamentoAvaliacoesController {
  constructor(
    private readonly agendamentoAvaliacoesService: AgendamentoAvaliacoesService,
  ) {}

  @Post()
  @Roles('PERSONAL')
  create(
    @Body() dto: CreateAgendamentoAvaliacaoDto,
    @User('id') personalId: number,
  ) {
    return this.agendamentoAvaliacoesService.create(dto, personalId);
  }

  @Get()
  @Roles('PERSONAL')
  findAll(@User('id') personalId: number) {
    return this.agendamentoAvaliacoesService.findAllByPersonal(personalId);
  }

  @Patch(':id')
  @Roles('PERSONAL')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAgendamentoAvaliacaoDto,
    @User('id') personalId: number,
  ) {
    return this.agendamentoAvaliacoesService.update(id, dto, personalId);
  }

  @Delete(':id')
  @Roles('PERSONAL')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @User('id') personalId: number,
  ) {
    return this.agendamentoAvaliacoesService.remove(id, personalId);
  }
}
