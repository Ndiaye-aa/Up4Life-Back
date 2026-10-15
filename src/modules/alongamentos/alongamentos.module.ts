import { Module } from '@nestjs/common';
import { AlongamentosService } from './alongamentos.service';
import { AlongamentosController } from './alongamentos.controller';

@Module({
  providers: [AlongamentosService],
  controllers: [AlongamentosController],
})
export class AlongamentosModule {}
