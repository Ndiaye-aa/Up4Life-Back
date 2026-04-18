import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { TreinosService } from './treinos.service';
import { CreateTreinoDto } from './dto/create-treino.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';

@Controller('treinos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TreinosController {
  constructor(private readonly treinosService: TreinosService) {}

  @Post()
  @Roles('PERSONAL')
  create(@Body() dto: CreateTreinoDto, @User('id') personalId: number) {
    return this.treinosService.create(dto, personalId);
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

  @Delete(':id')
  @Roles('PERSONAL')
  remove(@Param('id', ParseIntPipe) id: number, @User('id') personalId: number) {
    return this.treinosService.remove(id, personalId);
  }
}
