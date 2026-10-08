import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private pool: Pool;

  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // Sem este handler, um erro em conexão ociosa (ex.: o pooler do Supabase
    // fechando a conexão) vira exceção não capturada e derruba o processo.
    pool.on('error', (error) => {
      new Logger(PrismaService.name).error(
        `Erro em conexão ociosa do pool: ${error.message}`,
      );
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Conectado ao banco de dados.');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
