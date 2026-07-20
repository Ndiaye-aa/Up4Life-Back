import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from '../modules/auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Health check público (usado por load balancers e monitoramento).
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
