import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AvaliacoesService } from './avaliacoes.service';
import { CreateAvaliacaoDto } from './dto/create-avaliacao.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';

@Controller('avaliacoes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AvaliacoesController {
  constructor(private readonly avaliacoesService: AvaliacoesService) {}

  @Post()
  @Roles('PERSONAL')
  create(@Body() dto: CreateAvaliacaoDto, @User('id') personalId: number) {
    return this.avaliacoesService.create(dto, personalId);
  }

  @Get('aluno/:alunoId')
  @Roles('PERSONAL', 'ALUNO')
  findAllByAluno(
    @Param('alunoId', ParseIntPipe) alunoId: number,
    @User() user: { id: number; role: string },
  ) {
    return this.avaliacoesService.findAllByAluno(alunoId, user.id, user.role);
  }
}
