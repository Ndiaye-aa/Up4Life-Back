import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../modules/auth/auth.module';
import { PersonaisModule } from '../modules/personais/personais.module';
import { AlunosModule } from '../modules/alunos/alunos.module';
import { TreinosModule } from '../modules/treinos/treinos.module';
import { AvaliacoesModule } from '../modules/avaliacoes/avaliacoes.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ExerciciosModule } from '../modules/exercicios/exercicios.module';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PersonaisModule,
    AlunosModule,
    TreinosModule,
    AvaliacoesModule,
    ExerciciosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
