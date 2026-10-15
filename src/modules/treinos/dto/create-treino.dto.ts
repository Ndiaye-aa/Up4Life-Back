import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  IsDate,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoTreino } from '@prisma/client';
import { CreateItemTreinoDto } from './create-item-treino.dto';

export class CreateTreinoDto {
  @IsOptional()
  @IsBoolean()
  paraMim?: boolean;

  @ValidateIf((o: CreateTreinoDto) => !o.paraMim)
  @IsNotEmpty()
  @IsInt()
  alunoId?: number;

  @IsNotEmpty()
  @IsString()
  objetivo: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dataValidade?: Date;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana?: number;

  @IsOptional()
  @IsEnum(TipoTreino)
  tipo?: TipoTreino;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateItemTreinoDto)
  itens: CreateItemTreinoDto[];
}
