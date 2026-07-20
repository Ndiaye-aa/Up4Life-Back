import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../modules/auth/auth.module';
import { PersonaisModule } from '../modules/personais/personais.module';
import { AlunosModule } from '../modules/alunos/alunos.module';
import { TreinosModule } from '../modules/treinos/treinos.module';
import { AvaliacoesModule } from '../modules/avaliacoes/avaliacoes.module';
import { AgendamentoAvaliacoesModule } from '../modules/agendamento-avaliacoes/agendamento-avaliacoes.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ExerciciosModule } from '../modules/exercicios/exercicios.module';
import { NotificacoesModule } from '../modules/notificacoes/notificacoes.module';
import { AgendaModule } from '../modules/agenda/agenda.module';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../modules/auth/guards/roles.guard';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Limite global generoso; as rotas de auth têm limites próprios via @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    PersonaisModule,
    AlunosModule,
    TreinosModule,
    AvaliacoesModule,
    AgendamentoAvaliacoesModule,
    ExerciciosModule,
    NotificacoesModule,
    AgendaModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // A ordem importa: throttling antes de autenticar, roles depois de autenticar.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
