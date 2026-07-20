-- AlterTable: treino pode pertencer a um aluno OU ao próprio personal
ALTER TABLE "treino" ALTER COLUMN "id_aluno" DROP NOT NULL;
ALTER TABLE "treino" ADD COLUMN     "id_personal" INTEGER;

-- AlterTable: avaliação pode pertencer a um aluno OU ao próprio personal
ALTER TABLE "avaliacao" ALTER COLUMN "id_aluno" DROP NOT NULL;
ALTER TABLE "avaliacao" ADD COLUMN     "id_personal" INTEGER;

-- AddForeignKey
ALTER TABLE "treino" ADD CONSTRAINT "treino_id_personal_fkey" FOREIGN KEY ("id_personal") REFERENCES "personal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_id_personal_fkey" FOREIGN KEY ("id_personal") REFERENCES "personal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraint: exatamente um dono (aluno XOR personal)
ALTER TABLE "treino" ADD CONSTRAINT "treino_owner_check"
  CHECK (("id_aluno" IS NULL) <> ("id_personal" IS NULL));
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_owner_check"
  CHECK (("id_aluno" IS NULL) <> ("id_personal" IS NULL));
