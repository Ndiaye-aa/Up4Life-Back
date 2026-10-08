import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Lock por tabela. Não usar pg_advisory_lock: o adapter-pg e o pooler do
 * Supabase podem devolver conexões diferentes entre o lock e o unlock.
 *
 * Todo o controle de tempo usa o relógio do banco (nunca o do app), para que
 * instâncias com relógios diferentes não liberem/segurem o lock errado. As
 * colunas são `timestamp` sem fuso (o Prisma grava/lê em UTC), então o `now()`
 * precisa ser convertido com `AT TIME ZONE 'UTC'`: sem isso o valor gravado
 * depende do fuso da sessão do banco.
 */
@Injectable()
export class JobLockService {
  constructor(private readonly prisma: PrismaService) {}

  /** O TTL garante que um processo morto não trave o job para sempre. */
  async adquirir(nome: string, ttlMin = 10): Promise<boolean> {
    // Auto-semeia a linha: sem ela o UPDATE afetaria 0 linhas e o job nunca
    // rodaria, sem nenhum erro (ex.: migration sem o INSERT do lock).
    await this.prisma.$executeRaw`
      INSERT INTO job_lock (nome, bloqueado_ate)
      VALUES (${nome}, (now() AT TIME ZONE 'UTC') - interval '1 second')
      ON CONFLICT (nome) DO NOTHING`;

    const n = await this.prisma.$executeRaw`
      UPDATE job_lock
      SET bloqueado_ate = (now() AT TIME ZONE 'UTC') + make_interval(mins => ${ttlMin})
      WHERE nome = ${nome} AND bloqueado_ate < (now() AT TIME ZONE 'UTC')`;
    return n === 1;
  }

  async liberar(nome: string, resultado: unknown): Promise<void> {
    const json = JSON.stringify(resultado ?? null);
    await this.prisma.$executeRaw`
      UPDATE job_lock
      SET bloqueado_ate = (now() AT TIME ZONE 'UTC'),
          ultima_execucao_em = (now() AT TIME ZONE 'UTC'),
          ultimo_resultado = ${json}::jsonb
      WHERE nome = ${nome}`;
  }
}
