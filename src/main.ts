import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app/app.module';
import { getJwtSecret } from './common/config/env';

// Falha cedo se a configuração obrigatória estiver ausente.
getJwtSecret();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // A maioria dos provedores (Render, Railway, Fly, atrás de um load
  // balancer) termina TLS num proxy e repassa a requisição via HTTP interno
  // com X-Forwarded-For/-Proto. Sem isso, o Express vê todo mundo vindo do
  // IP do proxy — o ThrottlerGuard (rate limit por IP) trataria todos os
  // usuários como um só, e cookies Secure dependeriam de detecção errada de
  // HTTPS caso alguma checagem futura passe a usar req.secure.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const allowedOrigins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`Application is running on: http://0.0.0.0:${port}`, 'Bootstrap');
}
void bootstrap();
