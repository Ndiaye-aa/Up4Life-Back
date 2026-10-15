import { PartialType } from '@nestjs/mapped-types';
import { CreateAlongamentoDto } from './create-alongamento.dto';

export class UpdateAlongamentoDto extends PartialType(CreateAlongamentoDto) {}
