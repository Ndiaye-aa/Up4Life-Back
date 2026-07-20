import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { AgendaService } from './agenda.service';
import { SaveAgendaDto } from './dto/save-agenda.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';

@Controller('agenda')
@Roles('PERSONAL')
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @Get()
  findAll(@User('id') personalId: number) {
    return this.agendaService.findAllByPersonal(personalId);
  }

  @Put(':alunoId')
  save(
    @Param('alunoId', ParseIntPipe) alunoId: number,
    @Body() dto: SaveAgendaDto,
    @User('id') personalId: number,
  ) {
    return this.agendaService.save(personalId, alunoId, dto);
  }

  @Delete(':alunoId')
  remove(
    @Param('alunoId', ParseIntPipe) alunoId: number,
    @User('id') personalId: number,
  ) {
    return this.agendaService.remove(personalId, alunoId);
  }
}
