-- CreateEnum
CREATE TYPE "TipoTreino" AS ENUM ('EXERCICIOS', 'ALONGAMENTO');

-- AlterTable
ALTER TABLE "treino" ADD COLUMN "tipo" "TipoTreino" NOT NULL DEFAULT 'EXERCICIOS';

-- AlterTable
ALTER TABLE "aluno" ADD COLUMN "academia" VARCHAR(100);

-- AlterTable
ALTER TABLE "agenda_treino" ADD COLUMN "aviso_aula_minutos" INTEGER;
ALTER TABLE "agenda_treino" ADD CONSTRAINT "agenda_treino_aviso_aula_minutos_check" CHECK ("aviso_aula_minutos" IS NULL OR "aviso_aula_minutos" IN (15, 30, 60, 120));

-- CreateTable
CREATE TABLE "aviso_aula" (
    "id" SERIAL NOT NULL,
    "id_aluno" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "enviado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aviso_aula_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aviso_aula_id_aluno_data_key" ON "aviso_aula"("id_aluno", "data");

-- AddForeignKey
ALTER TABLE "aviso_aula" ADD CONSTRAINT "aviso_aula_id_aluno_fkey" FOREIGN KEY ("id_aluno") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lock do job de aviso de aula
INSERT INTO "job_lock" ("nome", "bloqueado_ate") VALUES ('avisos-aula', now()) ON CONFLICT ("nome") DO NOTHING;
