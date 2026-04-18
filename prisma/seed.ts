import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 + Driver Adapter
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const exercises = [
  { nome: 'Supino Reto (Barra)', grupoMuscular: 'Peitoral' },
  { nome: 'Supino Inclinado (Halteres)', grupoMuscular: 'Peitoral' },
  { nome: 'Crossover (Polia Alta)', grupoMuscular: 'Peitoral' },
  { nome: 'Crucifixo Máquina', grupoMuscular: 'Peitoral' },
  { nome: 'Puxada Aberta (Pulley)', grupoMuscular: 'Costas' },
  { nome: 'Remada Curvada (Barra)', grupoMuscular: 'Costas' },
  { nome: 'Remada Unilateral (Halter)', grupoMuscular: 'Costas' },
  { nome: 'Levantamento Terra', grupoMuscular: 'Costas' },
  { nome: 'Agachamento Livre (Barra)', grupoMuscular: 'Membros Inferiores' },
  { nome: 'Leg Press 45', grupoMuscular: 'Membros Inferiores' },
  { nome: 'Cadeira Extensora', grupoMuscular: 'Membros Inferiores' },
  { nome: 'Mesa Flexora', grupoMuscular: 'Membros Inferiores' },
  { nome: 'Afundo (Halteres)', grupoMuscular: 'Membros Inferiores' },
  { nome: 'Desenvolvimento (Halteres)', grupoMuscular: 'Ombros' },
  { nome: 'Elevação Lateral', grupoMuscular: 'Ombros' },
  { nome: 'Elevação Frontal', grupoMuscular: 'Ombros' },
  { nome: 'Rosca Direta (Barra W)', grupoMuscular: 'Braços' },
  { nome: 'Rosca Martelo', grupoMuscular: 'Braços' },
  { nome: 'Tríceps Corda', grupoMuscular: 'Braços' },
  { nome: 'Tríceps Testa', grupoMuscular: 'Braços' },
  { nome: 'Abdominal Supra', grupoMuscular: 'Abdômen' },
  { nome: 'Prancha Isométrica', grupoMuscular: 'Abdômen' },
  { nome: 'Elevação de Pernas', grupoMuscular: 'Abdômen' },
];

async function main() {
  console.log('🚀 Iniciando o Seed...');

  // 1. Criar ou atualizar o Personal
  const salt = await bcrypt.genSalt(10);
  const senhaPadrao = await bcrypt.hash('123456', salt);

  const personal = await prisma.personal.upsert({
    where: { telefone: '65999999999' },
    update: {},
    create: {
      nome: 'Adama',
      telefone: '65999999999',
      senha: senhaPadrao,
    },
  });
  console.log(`✅ Personal conferido: ${personal.nome}`);

  // 2. Semeando exercícios
  console.log('⏳ Semeando exercícios...');

  for (const ex of exercises) {
    // Agora o upsert funciona porque 'nome' é @unique no seu schema!
    await prisma.exercicio.upsert({
      where: { nome: ex.nome },
      update: { grupoMuscular: ex.grupoMuscular },
      create: {
        nome: ex.nome,
        grupoMuscular: ex.grupoMuscular,
      },
    });
  }

  console.log('✨ Seed finalizado com sucesso.');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });