import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../modules/auth/auth.module';
import { PersonaisModule } from '../modules/personais/personais.module';
import { AlunosModule } from '../modules/alunos/alunos.module';
import { TreinosModule } from '../modules/treinos/treinos.module';
import { AvaliacoesModule } from '../modules/avaliacoes/avaliacoes.module';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PersonaisModule,
    AlunosModule,
    TreinosModule,
    AvaliacoesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
