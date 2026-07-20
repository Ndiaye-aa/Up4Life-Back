import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { NotificacoesService } from './notificacoes.service';
import type { UsuarioPush } from './notificacoes.service';
import { SubscribePushDto, UnsubscribePushDto } from './dto/subscribe-push.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';

@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly notificacoesService: NotificacoesService) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return this.notificacoesService.getVapidPublicKey();
  }

  @Get('status')
  @Roles('ALUNO', 'PERSONAL')
  status(@User() usuario: UsuarioPush) {
    return this.notificacoesService.status(usuario);
  }

  @Post('subscribe')
  @Roles('ALUNO', 'PERSONAL')
  subscribe(@Body() dto: SubscribePushDto, @User() usuario: UsuarioPush) {
    return this.notificacoesService.subscribe(usuario, dto);
  }

  @Delete('subscribe')
  @Roles('ALUNO', 'PERSONAL')
  unsubscribe(@Body() dto: UnsubscribePushDto, @User() usuario: UsuarioPush) {
    return this.notificacoesService.unsubscribe(usuario, dto.endpoint);
  }
}
