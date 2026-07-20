import { IsDate, IsInt, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAgendamentoAvaliacaoDto {
  @IsNotEmpty()
  @IsInt()
  alunoId: number;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  dataAgendada: Date;
}
