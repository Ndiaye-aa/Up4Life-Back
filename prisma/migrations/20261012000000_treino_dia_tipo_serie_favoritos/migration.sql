-- CreateEnum
CREATE TYPE "TipoSerie" AS ENUM ('NORMAL', 'BI_SET', 'TRI_SET', 'SUPER_SET', 'DROP_SET', 'PIRAMIDE_CRESCENTE', 'PIRAMIDE_DECRESCENTE', 'CIRCUITO', 'REST_PAUSE', 'METODO_21');

-- AlterTable
ALTER TABLE "treino" ADD COLUMN "dia_semana" INTEGER;
ALTER TABLE "treino" ADD CONSTRAINT "treino_dia_semana_check" CHECK ("dia_semana" IS NULL OR "dia_semana" BETWEEN 0 AND 6);

-- AlterTable
ALTER TABLE "item_treino" ADD COLUMN "tipo_serie" "TipoSerie" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "grupo_combinado" INTEGER,
ADD COLUMN "etapas" JSONB,
ADD COLUMN "pausa_segundos" INTEGER;

-- CreateTable
CREATE TABLE "exercicio_favorito" (
    "id_personal" INTEGER NOT NULL,
    "id_exercicio" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercicio_favorito_pkey" PRIMARY KEY ("id_personal","id_exercicio")
);

-- AddForeignKey
ALTER TABLE "exercicio_favorito" ADD CONSTRAINT "exercicio_favorito_id_personal_fkey" FOREIGN KEY ("id_personal") REFERENCES "personal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercicio_favorito" ADD CONSTRAINT "exercicio_favorito_id_exercicio_fkey" FOREIGN KEY ("id_exercicio") REFERENCES "exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
