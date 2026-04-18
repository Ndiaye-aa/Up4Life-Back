import { IsNotEmpty, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateAvaliacaoDto {
  @IsNotEmpty()
  @IsNumber()
  alunoId: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  peso: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.5)
  @Max(3.5)
  altura: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  idade: number;

  @IsOptional()
  @IsNumber()
  cintura?: number;

  @IsOptional()
  @IsNumber()
  quadril?: number;

  // Dobras
  @IsOptional()
  @IsNumber()
  peitoral?: number;

  @IsOptional()
  @IsNumber()
  axilarMedia?: number;

  @IsOptional()
  @IsNumber()
  triceps?: number;

  @IsOptional()
  @IsNumber()
  subescapular?: number;

  @IsOptional()
  @IsNumber()
  abdominal?: number;

  @IsOptional()
  @IsNumber()
  supraIliaca?: number;

  @IsOptional()
  @IsNumber()
  coxa?: number;
}
