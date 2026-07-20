import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateExercicioDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nome: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  grupoMuscular: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}
