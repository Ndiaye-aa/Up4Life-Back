import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  @Get()
  ok() {
    return { status: 'ok' };
  }
}
