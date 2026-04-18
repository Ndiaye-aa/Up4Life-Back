import { IsNotEmpty, IsString, IsPhoneNumber, IsOptional, IsEnum, IsDate, MaxDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAlunoDto {
  @IsNotEmpty()
  @IsString()
  nome: string;

  @IsNotEmpty()
  @IsPhoneNumber('BR') // Seguindo o padrão brasileiro como base, ou s/ país p/ E.164 genérico
  @IsString()
  telefone: string;

  @IsNotEmpty()
  @IsString()
  senha: string;

  @IsOptional()
  @IsEnum(['M', 'F'], { message: 'Sexo deve ser M ou F' })
  sexo?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @MaxDate(new Date(), { message: 'Data de nascimento não pode ser no futuro' })
  nascimento?: Date;

  @IsOptional()
  @IsString()
  historicoSaude?: string;
}
