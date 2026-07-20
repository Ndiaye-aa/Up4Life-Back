import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateAvaliacaoDto {
  @IsOptional()
  @IsBoolean()
  paraMim?: boolean;

  @ValidateIf((o: CreateAvaliacaoDto) => !o.paraMim)
  @IsNotEmpty()
  @IsNumber()
  alunoId?: number;

  // Sexo é obrigatório na autoavaliação: Personal não tem sexo cadastrado
  @ValidateIf((o: CreateAvaliacaoDto) => o.paraMim === true)
  @IsNotEmpty()
  @IsIn(['M', 'F'])
  sexo?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(999.99)
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
  @Min(0)
  @Max(999.99)
  cintura?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999.99)
  quadril?: number;

  // Dobras
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999.99)
  peitoral?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999.99)
  axilarMedia?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999.99)
  triceps?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999.99)
  subescapular?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999.99)
  abdominal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999.99)
  supraIliaca?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999.99)
  coxa?: number;

  // Perímetros
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999.99)
  perimetroTorax?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999.99)
  perimetroAbdomen?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999.99)
  perimetroCoxa?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999.99)
  perimetroPanturrilha?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999.99)
  perimetroBraco?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999.99)
  perimetroAntebraco?: number;
}
