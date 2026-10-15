import { IsString, MaxLength } from 'class-validator';

export class EtapaSerieDto {
  @IsString()
  @MaxLength(20)
  carga: string;

  @IsString()
  @MaxLength(20)
  repeticoes: string;
}
