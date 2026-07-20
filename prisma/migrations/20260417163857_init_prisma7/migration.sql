-- CreateTable
CREATE TABLE "personal" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(50) NOT NULL,
    "telefone" VARCHAR(15) NOT NULL,
    "senha" VARCHAR(255) NOT NULL,

    CONSTRAINT "personal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aluno" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(50) NOT NULL,
    "telefone" VARCHAR(15) NOT NULL,
    "senha" VARCHAR(255) NOT NULL,
    "id_personal" INTEGER,
    "sexo" CHAR(1),
    "nascimento" DATE,
    "historico_saude" TEXT,
    "criado_em" DATE DEFAULT CURRENT_DATE,

    CONSTRAINT "aluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacao" (
    "id" SERIAL NOT NULL,
    "id_aluno" INTEGER NOT NULL,
    "peso" DECIMAL(5,2) NOT NULL,
    "altura" DECIMAL(3,2) NOT NULL,
    "idade" INTEGER NOT NULL,
    "cintura" DECIMAL(5,2),
    "quadril" DECIMAL(5,2),
    "peitoral" DECIMAL(5,2),
    "axilar_media" DECIMAL(5,2),
    "triceps" DECIMAL(5,2),
    "subescapular" DECIMAL(5,2),
    "abdominal" DECIMAL(5,2),
    "supra_iliaca" DECIMAL(5,2),
    "coxa" DECIMAL(5,2),
    "imc" DECIMAL(5,2),
    "iac" DECIMAL(5,2),
    "densidade_corporal" DECIMAL(6,4),
    "percentual_gordura" DECIMAL(5,2),
    "data_avaliacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treino" (
    "id" SERIAL NOT NULL,
    "id_aluno" INTEGER NOT NULL,
    "objetivo" VARCHAR(100) NOT NULL,
    "data_validade" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_treino" (
    "id" SERIAL NOT NULL,
    "id_treino" INTEGER NOT NULL,
    "exercicio" VARCHAR(100) NOT NULL,
    "series" INTEGER NOT NULL,
    "repeticoes" VARCHAR(20) NOT NULL,
    "carga" VARCHAR(20),
    "ordem" INTEGER NOT NULL,
    "descanso" INTEGER,

    CONSTRAINT "item_treino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercicio" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "grupo_muscular" VARCHAR(50) NOT NULL,

    CONSTRAINT "exercicio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personal_telefone_key" ON "personal"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "aluno_telefone_key" ON "aluno"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "exercicio_nome_key" ON "exercicio"("nome");

-- AddForeignKey
ALTER TABLE "aluno" ADD CONSTRAINT "aluno_id_personal_fkey" FOREIGN KEY ("id_personal") REFERENCES "personal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_id_aluno_fkey" FOREIGN KEY ("id_aluno") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treino" ADD CONSTRAINT "treino_id_aluno_fkey" FOREIGN KEY ("id_aluno") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_treino" ADD CONSTRAINT "item_treino_id_treino_fkey" FOREIGN KEY ("id_treino") REFERENCES "treino"("id") ON DELETE CASCADE ON UPDATE CASCADE;
