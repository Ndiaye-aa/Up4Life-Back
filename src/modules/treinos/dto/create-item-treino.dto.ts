import { IsNotEmpty, IsString, IsInt, IsOptional, Min } from 'class-validator';

export class CreateItemTreinoDto {
  @IsNotEmpty()
  @IsString()
  exercicio: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  series: number;

  @IsNotEmpty()
  @IsString()
  repeticoes: string;

  @IsOptional()
  @IsString()
  carga?: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  ordem: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  descanso?: number;
}
