-- Índices nas chaves estrangeiras filtradas com frequência (o Postgres não as indexa sozinho).
CREATE INDEX "treino_id_aluno_idx" ON "treino"("id_aluno");
CREATE INDEX "treino_id_personal_idx" ON "treino"("id_personal");
CREATE INDEX "item_treino_id_treino_idx" ON "item_treino"("id_treino");
CREATE INDEX "push_subscription_id_aluno_idx" ON "push_subscription"("id_aluno");
CREATE INDEX "push_subscription_id_personal_idx" ON "push_subscription"("id_personal");
CREATE INDEX "aluno_id_personal_idx" ON "aluno"("id_personal");
CREATE INDEX "avaliacao_id_aluno_idx" ON "avaliacao"("id_aluno");
CREATE INDEX "avaliacao_id_personal_idx" ON "avaliacao"("id_personal");
CREATE INDEX "agendamento_avaliacao_id_aluno_idx" ON "agendamento_avaliacao"("id_aluno");
CREATE INDEX "agendamento_avaliacao_id_personal_idx" ON "agendamento_avaliacao"("id_personal");
