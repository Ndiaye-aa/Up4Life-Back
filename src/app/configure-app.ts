import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/**
 * Configuração de runtime compartilhada entre `main.ts` e os testes e2e.
 * Sem isso o app de teste não aplica o ValidationPipe e as validações dos DTOs
 * (datas, limites, whitelist) nunca são exercitadas.
 */
export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
