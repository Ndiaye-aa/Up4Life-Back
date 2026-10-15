import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class DuplicarTreinoDto {
  @IsOptional()
  @IsBoolean()
  paraMim?: boolean;

  @ValidateIf((o: DuplicarTreinoDto) => !o.paraMim)
  @IsNotEmpty()
  @IsInt()
  alunoId?: number;

  @IsOptional()
  @IsString()
  objetivo?: string;
}
