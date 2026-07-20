import {
  IsNotEmpty,
  IsString,
  IsPhoneNumber,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

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
}
