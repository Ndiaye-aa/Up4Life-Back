import {
  IsNotEmpty,
  IsString,
  IsPhoneNumber,
  IsIn,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { FUSOS_BRASILEIROS } from '../../../common/datas/fuso';

export class UpdatePersonalDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsPhoneNumber('BR')
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  senha?: string;

  // Exigida em PATCH /personais/me ao alterar telefone ou senha (credenciais de login).
  @IsOptional()
  @IsString()
  senhaAtual?: string;

  // Define a data das sessões e os horários da agenda dos alunos do personal.
  @IsOptional()
  @IsIn(FUSOS_BRASILEIROS, { message: 'Fuso horário inválido.' })
  fusoHorario?: string;
}
