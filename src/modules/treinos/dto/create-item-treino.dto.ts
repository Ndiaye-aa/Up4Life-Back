import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoSerie } from '@prisma/client';
import { EtapaSerieDto } from './etapa-serie.dto';

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

  @IsOptional()
  @IsEnum(TipoSerie)
  tipoSerie?: TipoSerie;

  @IsOptional()
  @IsString()
  obs?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  grupoCombinado?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => EtapaSerieDto)
  etapas?: EtapaSerieDto[];

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  pausaSegundos?: number;
}
