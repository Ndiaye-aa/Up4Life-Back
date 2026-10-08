import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class SaveAgendaDto {
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  dias: number[];

  @IsOptional()
  @IsObject()
  // { "1": { "hora": "07:00", "modalidade": "PRESENCIAL" } } — o formato
  // legado { "1": "07:00" } ainda é aceito e convertido (modalidade PRESENCIAL).
  horarios?: Record<string, string | { hora: string; modalidade?: string }>;
}
