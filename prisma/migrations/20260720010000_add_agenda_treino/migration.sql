-- CreateTable
CREATE TABLE "agenda_treino" (
    "id" SERIAL NOT NULL,
    "id_personal" INTEGER NOT NULL,
    "id_aluno" INTEGER NOT NULL,
    "dias" INTEGER[],
    "horarios" JSONB,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agenda_treino_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agenda_treino_id_aluno_key" ON "agenda_treino"("id_aluno");

-- AddForeignKey
ALTER TABLE "agenda_treino" ADD CONSTRAINT "agenda_treino_id_personal_fkey" FOREIGN KEY ("id_personal") REFERENCES "personal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_treino" ADD CONSTRAINT "agenda_treino_id_aluno_fkey" FOREIGN KEY ("id_aluno") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;
