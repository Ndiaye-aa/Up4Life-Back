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
import { AlunosService } from './alunos.service';
import { CreateAlunoDto } from './dto/create-aluno.dto';
import { UpdateAlunoDto } from './dto/update-aluno.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';
import { GetPersonalId } from '../auth/decorators/get-personal-id.decorator';

@Controller('alunos')
@Roles('PERSONAL')
export class AlunosController {
  constructor(private readonly alunosService: AlunosService) {}

  @Post()
  create(@Body() dto: CreateAlunoDto, @GetPersonalId() personalId: number) {
    return this.alunosService.create(dto, personalId);
  }

  @Get()
  findAll(@GetPersonalId() personalId: number) {
    return this.alunosService.findAllByPersonal(personalId);
  }

  @Get('me')
  @Roles('ALUNO')
  findSelf(@User('id') alunoId: number) {
    return this.alunosService.findSelf(alunoId);
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
