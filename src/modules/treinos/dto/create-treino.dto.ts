import { IsNotEmpty, IsString, IsInt, IsOptional, IsDate, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateItemTreinoDto } from './create-item-treino.dto';

export class CreateTreinoDto {
  @IsNotEmpty()
  @IsInt()
  alunoId: number;

  @IsNotEmpty()
  @IsString()
  objetivo: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dataValidade?: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemTreinoDto)
  itens: CreateItemTreinoDto[];
}
