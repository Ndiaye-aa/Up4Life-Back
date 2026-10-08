/**
 * Converte `agenda_treino.horarios` do formato antigo ({ "1": "07:00" }) para
 * o novo ({ "1": { "hora": "07:00", "modalidade": "PRESENCIAL" } }).
 *
 * Idempotente: entradas que já estão no formato novo são mantidas, então
 * pode ser executado mais de uma vez. As agendas existentes ficam com
 * `acompanhamento_desde` = data do deploy (default da coluna).
 *
 * Uso: npx ts-node scripts/migrar-horarios-agenda.ts
 */
import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

import { converterHorarios } from '../src/common/sessoes/horarios-legado';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const agendas = await prisma.agendaTreino.findMany({
    select: { id: true, horarios: true },
  });

  let atualizadas = 0;
  for (const agenda of agendas) {
    const { convertido, alterado } = converterHorarios(agenda.horarios);
    if (!alterado) continue;
    await prisma.agendaTreino.update({
      where: { id: agenda.id },
      data: { horarios: convertido as Prisma.InputJsonValue },
    });
    atualizadas++;
  }

  console.log(
    `Agendas verificadas: ${agendas.length}. Convertidas: ${atualizadas}.`,
  );
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
