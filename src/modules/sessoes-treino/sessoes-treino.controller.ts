import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';
import {
  CreateSessaoDto,
  ListSessoesQueryDto,
  UpdateSessaoDto,
} from './dto/create-sessao.dto';
import { SessoesTreinoService, type Ator } from './sessoes-treino.service';

@Controller('sessoes-treino')
export class SessoesTreinoController {
  constructor(private readonly service: SessoesTreinoService) {}

  @Post()
  @Roles('PERSONAL', 'ALUNO')
  create(@Body() dto: CreateSessaoDto, @User() ator: Ator) {
    return this.service.create(dto, ator);
  }

  @Get()
  @Roles('PERSONAL', 'ALUNO')
  findAll(@Query() query: ListSessoesQueryDto, @User() ator: Ator) {
    return this.service.findAll(query, ator);
  }

  @Get(':id')
  @Roles('PERSONAL', 'ALUNO')
  findOne(@Param('id', ParseIntPipe) id: number, @User() ator: Ator) {
    return this.service.findOne(id, ator);
  }

  @Patch(':id')
  @Roles('PERSONAL', 'ALUNO')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSessaoDto,
    @User() ator: Ator,
  ) {
    return this.service.update(id, dto, ator);
  }

  @Delete(':id')
  @Roles('PERSONAL')
  remove(@Param('id', ParseIntPipe) id: number, @User() ator: Ator) {
    return this.service.remove(id, ator);
  }
}
