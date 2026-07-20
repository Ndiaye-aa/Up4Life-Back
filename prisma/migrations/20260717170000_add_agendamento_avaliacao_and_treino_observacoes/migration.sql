-- CreateEnum
CREATE TYPE "status_agendamento" AS ENUM ('PENDENTE', 'REALIZADA', 'CANCELADA');

-- AlterTable
ALTER TABLE "treino" ADD COLUMN     "observacoes" TEXT;

-- CreateTable
CREATE TABLE "agendamento_avaliacao" (
    "id" SERIAL NOT NULL,
    "id_aluno" INTEGER NOT NULL,
    "id_personal" INTEGER NOT NULL,
    "data_agendada" TIMESTAMP(3) NOT NULL,
    "status" "status_agendamento" NOT NULL DEFAULT 'PENDENTE',
    "id_avaliacao" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agendamento_avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agendamento_avaliacao_id_avaliacao_key" ON "agendamento_avaliacao"("id_avaliacao");

-- AddForeignKey
ALTER TABLE "agendamento_avaliacao" ADD CONSTRAINT "agendamento_avaliacao_id_aluno_fkey" FOREIGN KEY ("id_aluno") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento_avaliacao" ADD CONSTRAINT "agendamento_avaliacao_id_personal_fkey" FOREIGN KEY ("id_personal") REFERENCES "personal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento_avaliacao" ADD CONSTRAINT "agendamento_avaliacao_id_avaliacao_fkey" FOREIGN KEY ("id_avaliacao") REFERENCES "avaliacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
