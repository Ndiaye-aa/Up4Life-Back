-- CreateEnum
CREATE TYPE "status_sessao" AS ENUM ('REALIZADA', 'PARCIAL', 'FALTA', 'FALTA_JUSTIFICADA');

-- CreateEnum
CREATE TYPE "origem_sessao" AS ENUM ('ALUNO', 'PERSONAL', 'AUTOMATICA');

-- CreateEnum
CREATE TYPE "modalidade" AS ENUM ('PRESENCIAL', 'ONLINE');

-- AlterTable
ALTER TABLE "personal" ADD COLUMN     "fuso_horario" VARCHAR(40) NOT NULL DEFAULT 'America/Sao_Paulo';

-- AlterTable
ALTER TABLE "aluno" ADD COLUMN     "consentimento_saude_em" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "agenda_treino" ADD COLUMN     "acompanhamento_desde" DATE NOT NULL DEFAULT CURRENT_DATE;

-- CreateTable
CREATE TABLE "sessao_treino" (
    "id" SERIAL NOT NULL,
    "id_aluno" INTEGER NOT NULL,
    "id_treino" INTEGER,
    "treino_objetivo" VARCHAR(100),
    "data" DATE NOT NULL,
    "prevista" BOOLEAN NOT NULL,
    "status" "status_sessao" NOT NULL,
    "origem" "origem_sessao" NOT NULL,
    "modalidade" "modalidade",
    "iniciada_em" TIMESTAMP(3),
    "concluida_em" TIMESTAMP(3),
    "motivo_falta" VARCHAR(500),
    "rpe" SMALLINT,
    "disposicao" SMALLINT,
    "dor" BOOLEAN NOT NULL DEFAULT false,
    "dor_local" VARCHAR(120),
    "comentario_aluno" VARCHAR(1000),
    "resposta_personal" VARCHAR(1000),
    "validada_em" TIMESTAMP(3),
    "id_reposicao_de" INTEGER,
    "notificado_aluno_em" TIMESTAMP(3),
    "notificado_personal_em" TIMESTAMP(3),
    "mensagem_chave" VARCHAR(40),
    "atualizado_por_role" VARCHAR(10),
    "version" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessao_treino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessao_item" (
    "id" SERIAL NOT NULL,
    "id_sessao" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "exercicio" VARCHAR(120) NOT NULL,
    "grupo_muscular" VARCHAR(50),
    "series_feitas" INTEGER,
    "reps_feitas" VARCHAR(20),
    "carga_texto" VARCHAR(30),
    "carga_kg" DECIMAL(6,2),
    "concluido" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sessao_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_lock" (
    "nome" VARCHAR(60) NOT NULL,
    "bloqueado_ate" TIMESTAMP(3) NOT NULL,
    "ultima_execucao_em" TIMESTAMP(3),
    "ultimo_resultado" JSONB,

    CONSTRAINT "job_lock_pkey" PRIMARY KEY ("nome")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessao_treino_id_reposicao_de_key" ON "sessao_treino"("id_reposicao_de");

-- CreateIndex
CREATE INDEX "sessao_treino_data_status_idx" ON "sessao_treino"("data", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sessao_treino_id_aluno_data_key" ON "sessao_treino"("id_aluno", "data");

-- CreateIndex
CREATE UNIQUE INDEX "sessao_item_id_sessao_ordem_key" ON "sessao_item"("id_sessao", "ordem");

-- AddForeignKey
ALTER TABLE "sessao_treino" ADD CONSTRAINT "sessao_treino_id_reposicao_de_fkey" FOREIGN KEY ("id_reposicao_de") REFERENCES "sessao_treino"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao_treino" ADD CONSTRAINT "sessao_treino_id_aluno_fkey" FOREIGN KEY ("id_aluno") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao_treino" ADD CONSTRAINT "sessao_treino_id_treino_fkey" FOREIGN KEY ("id_treino") REFERENCES "treino"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao_item" ADD CONSTRAINT "sessao_item_id_sessao_fkey" FOREIGN KEY ("id_sessao") REFERENCES "sessao_treino"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Integridade do feedback e da reposição
ALTER TABLE "sessao_treino"
  ADD CONSTRAINT "sessao_rpe_chk"        CHECK ("rpe" IS NULL OR "rpe" BETWEEN 1 AND 10),
  ADD CONSTRAINT "sessao_disposicao_chk" CHECK ("disposicao" IS NULL OR "disposicao" BETWEEN 1 AND 5),
  ADD CONSTRAINT "sessao_dor_local_chk"  CHECK ("dor" OR "dor_local" IS NULL),
  ADD CONSTRAINT "sessao_reposicao_chk"  CHECK ("id_reposicao_de" IS NULL OR "prevista" = false);

-- Locks dos jobs
INSERT INTO "job_lock" ("nome", "bloqueado_ate") VALUES
  ('fechamento-faltas',   now()),
  ('lembretes-avaliacao', now());
