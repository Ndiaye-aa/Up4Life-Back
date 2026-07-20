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
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
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

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateItemTreinoDto)
  itens: CreateItemTreinoDto[];
}
