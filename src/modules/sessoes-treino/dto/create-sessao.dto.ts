import { OmitType, PartialType } from '@nestjs/mapped-types';
import { StatusSessao } from '@prisma/client';
import { IsDataYmd } from '../../../common/datas/data-ymd.decorator';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SessaoItemDto {
  @IsInt()
  @Min(1)
  ordem: number;

  @IsString()
  @MaxLength(120)
  exercicio: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  seriesFeitas?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  repsFeitas?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  cargaTexto?: string;

  @IsBoolean()
  concluido: boolean;
}

export class CreateSessaoDto {
  // Obrigatório para PERSONAL, ignorado para ALUNO (vem do JWT).
  @IsOptional()
  @IsInt()
  alunoId?: number;

  // YYYY-MM-DD no fuso do personal.
  @IsDataYmd()
  data: string;

  @IsEnum(StatusSessao)
  status: StatusSessao;

  @IsOptional()
  @IsInt()
  treinoId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivoFalta?: string;

  @IsOptional()
  @IsISO8601()
  iniciadaEm?: string;

  @IsOptional()
  @IsISO8601()
  concluidaEm?: string;

  @IsOptional()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SessaoItemDto)
  itens?: SessaoItemDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rpe?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  disposicao?: number;

  @IsOptional()
  @IsBoolean()
  dor?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dorLocal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comentarioAluno?: string;
}

export class UpdateSessaoDto extends PartialType(
  OmitType(CreateSessaoDto, ['alunoId', 'data'] as const),
) {
  @IsInt()
  @Min(0)
  version: number;

  // Somente PERSONAL.
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  respostaPersonal?: string;

  // Somente PERSONAL.
  @IsOptional()
  @IsBoolean()
  validar?: boolean;
}

export class ListSessoesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  alunoId?: number;

  @IsOptional()
  @IsDataYmd()
  de?: string;

  @IsOptional()
  @IsDataYmd()
  ate?: string;
}
