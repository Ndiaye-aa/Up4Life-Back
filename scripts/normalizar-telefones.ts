/**
 * Normaliza os telefones já gravados (remove máscara, mantém só dígitos).
 *
 * Registros com máscara nunca conseguem logar (o login busca só dígitos),
 * então este script corrige a base existente. Se dois registros colidirem no
 * mesmo número normalizado, o conflito é reportado e precisa de decisão manual.
 *
 * Uso: npx ts-node scripts/normalizar-telefones.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const normalizar = (telefone: string) => telefone.replace(/\D/g, '');

interface Registro {
  id: number;
  telefone: string;
}

function planejar(nome: string, registros: Registro[]): Registro[] {
  const pendentes: Registro[] = [];

  for (const registro of registros) {
    const telefone = normalizar(registro.telefone);
    if (telefone === registro.telefone) continue;

    const conflito = registros.find(
      (outro) =>
        outro.id !== registro.id && normalizar(outro.telefone) === telefone,
    );
    if (conflito) {
      console.error(
        `[${nome}] CONFLITO: id=${registro.id} (${registro.telefone}) e id=${conflito.id} ` +
          `(${conflito.telefone}) normalizam para ${telefone} — resolver manualmente.`,
      );
      continue;
    }

    pendentes.push({ id: registro.id, telefone });
  }

  console.log(
    `[${nome}] ${registros.length} registros verificados, ${pendentes.length} a corrigir.`,
  );
  return pendentes;
}

async function main() {
  const personais = await prisma.personal.findMany({
    select: { id: true, telefone: true },
  });
  for (const { id, telefone } of planejar('personal', personais)) {
    await prisma.personal.update({ where: { id }, data: { telefone } });
  }

  const alunos = await prisma.aluno.findMany({
    select: { id: true, telefone: true },
  });
  for (const { id, telefone } of planejar('aluno', alunos)) {
    await prisma.aluno.update({ where: { id }, data: { telefone } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
