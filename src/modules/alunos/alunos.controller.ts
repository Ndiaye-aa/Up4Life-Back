import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { AlunosService } from './alunos.service';
import { ProgressoService } from '../progresso/progresso.service';
import { CreateAlunoDto } from './dto/create-aluno.dto';
import { UpdateAlunoDto } from './dto/update-aluno.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';
import { GetPersonalId } from '../auth/decorators/get-personal-id.decorator';

@Controller('alunos')
@Roles('PERSONAL')
export class AlunosController {
  constructor(
    private readonly alunosService: AlunosService,
    private readonly progressoService: ProgressoService,
  ) {}

  @Post()
  create(@Body() dto: CreateAlunoDto, @GetPersonalId() personalId: number) {
    return this.alunosService.create(dto, personalId);
  }

  // As rotas de progresso ficam aqui, declaradas antes de `:id`, para que
  // `progresso-resumo` nunca seja capturada por `alunos/:id` (ParseIntPipe → 400)
  // independentemente da ordem de registro dos módulos.
  @Get('progresso-resumo')
  progressoResumo(@GetPersonalId() personalId: number) {
    return this.progressoService.resumo(personalId);
  }

  @Get('me/progresso')
  @Roles('ALUNO')
  meuProgresso(
    @User('id') alunoId: number,
    @Query('periodo') periodo?: string,
  ) {
    return this.progressoService.progresso(alunoId, periodo);
  }

  @Get()
  findAll(@GetPersonalId() personalId: number) {
    return this.alunosService.findAllByPersonal(personalId);
  }

  @Get(':id/progresso')
  progressoDoAluno(
    @Param('id', ParseIntPipe) alunoId: number,
    @GetPersonalId() personalId: number,
    @Query('periodo') periodo?: string,
  ) {
    return this.progressoService.progressoDoAluno(alunoId, personalId, periodo);
  }

  @Get('me')
  @Roles('ALUNO')
  findSelf(@User('id') alunoId: number) {
    return this.alunosService.findSelf(alunoId);
  }

  @Post('me/consentimento-saude')
  @Roles('ALUNO')
  consentimentoSaude(@User('id') alunoId: number) {
    return this.alunosService.registrarConsentimentoSaude(alunoId);
  }

  @Patch('me')
  @Roles('ALUNO')
  updateSelf(@Body() dto: UpdateAlunoDto, @User('id') alunoId: number) {
    return this.alunosService.updateSelf(alunoId, dto);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetPersonalId() personalId: number,
  ) {
    return this.alunosService.findOne(id, personalId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAlunoDto,
    @GetPersonalId() personalId: number,
  ) {
    return this.alunosService.update(id, dto, personalId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetPersonalId() personalId: number,
  ) {
    return this.alunosService.remove(id, personalId);
  }
}
