-- Remove o aviso de aula
DROP TABLE "aviso_aula";
ALTER TABLE "agenda_treino" DROP CONSTRAINT "agenda_treino_aviso_aula_minutos_check";
ALTER TABLE "agenda_treino" DROP COLUMN "aviso_aula_minutos";
DELETE FROM "job_lock" WHERE "nome" = 'avisos-aula';

-- CreateTable
CREATE TABLE "alongamento" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "grupo_muscular" VARCHAR(50) NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "alongamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alongamento_favorito" (
    "id_personal" INTEGER NOT NULL,
    "id_alongamento" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alongamento_favorito_pkey" PRIMARY KEY ("id_personal","id_alongamento")
);

-- CreateIndex
CREATE UNIQUE INDEX "alongamento_nome_key" ON "alongamento"("nome");

-- AddForeignKey
ALTER TABLE "alongamento_favorito" ADD CONSTRAINT "alongamento_favorito_id_personal_fkey" FOREIGN KEY ("id_personal") REFERENCES "personal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alongamento_favorito" ADD CONSTRAINT "alongamento_favorito_id_alongamento_fkey" FOREIGN KEY ("id_alongamento") REFERENCES "alongamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Move os alongamentos do catálogo de exercícios para a nova tabela
INSERT INTO "alongamento" ("nome", "grupo_muscular", "descricao")
SELECT "nome", "grupo_muscular", "descricao" FROM "exercicio" WHERE "grupo_muscular" = 'Alongamento';

INSERT INTO "alongamento_favorito" ("id_personal", "id_alongamento", "criado_em")
SELECT f."id_personal", a."id", f."criado_em"
FROM "exercicio_favorito" f
JOIN "exercicio" e ON e."id" = f."id_exercicio"
JOIN "alongamento" a ON a."nome" = e."nome"
WHERE e."grupo_muscular" = 'Alongamento';

DELETE FROM "exercicio" WHERE "grupo_muscular" = 'Alongamento';
