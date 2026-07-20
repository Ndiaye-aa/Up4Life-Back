import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { CreateAlunoDto } from './create-aluno.dto';

export class UpdateAlunoDto extends PartialType(CreateAlunoDto) {
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  // Exigida em PATCH /alunos/me ao alterar telefone ou senha (credenciais de login).
  @IsOptional()
  @IsString()
  senhaAtual?: string;
}
