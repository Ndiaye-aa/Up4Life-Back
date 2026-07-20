import { IsDate, IsEnum, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { StatusAgendamento } from '@prisma/client';

export class UpdateAgendamentoAvaliacaoDto {
  @IsOptional()
  @IsEnum(StatusAgendamento)
  status?: StatusAgendamento;

  @IsOptional()
  @IsInt()
  avaliacaoId?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dataAgendada?: Date;

  @IsOptional()
  @IsInt()
  alunoId?: number;
}
