-- AlterTable
ALTER TABLE "agendamento_avaliacao" ADD COLUMN     "lembrete_dia_em" TIMESTAMP(3),
ADD COLUMN     "lembrete_vespera_em" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "push_subscription" (
    "id" SERIAL NOT NULL,
    "id_aluno" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscription_endpoint_key" ON "push_subscription"("endpoint");

-- AddForeignKey
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_id_aluno_fkey" FOREIGN KEY ("id_aluno") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;
