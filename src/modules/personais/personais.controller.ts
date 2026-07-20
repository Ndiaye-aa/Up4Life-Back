import { Controller, Get, Patch, Body } from '@nestjs/common';
import { PersonaisService } from './personais.service';
import { UpdatePersonalDto } from './dto/update-personal.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';

@Controller('personais')
@Roles('PERSONAL')
export class PersonaisController {
  constructor(private readonly personaisService: PersonaisService) {}

  @Get('me')
  findSelf(@User('id') personalId: number) {
    return this.personaisService.findSelf(personalId);
  }

  @Patch('me')
  updateSelf(@Body() dto: UpdatePersonalDto, @User('id') personalId: number) {
    return this.personaisService.updateSelf(personalId, dto);
  }
}
