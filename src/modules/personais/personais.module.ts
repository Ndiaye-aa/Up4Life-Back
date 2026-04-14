import { Module } from '@nestjs/common';
import { PersonaisController } from './personais.controller';
import { PersonaisService } from './personais.service';

@Module({
  controllers: [PersonaisController],
  providers: [PersonaisService]
})
export class PersonaisModule {}
