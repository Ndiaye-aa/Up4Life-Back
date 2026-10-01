-- CreateIndex
CREATE INDEX "agendamento_avaliacao_data_agendada_status_idx" ON "agendamento_avaliacao"("data_agendada", "status");

-- CreateIndex
CREATE INDEX "agendamento_avaliacao_lembrete_dia_em_idx" ON "agendamento_avaliacao"("lembrete_dia_em");

-- CreateIndex
CREATE INDEX "agendamento_avaliacao_lembrete_vespera_em_idx" ON "agendamento_avaliacao"("lembrete_vespera_em");

-- CreateIndex
CREATE INDEX "avaliacao_data_avaliacao_idx" ON "avaliacao"("data_avaliacao");

-- CreateIndex
CREATE INDEX "treino_criado_em_idx" ON "treino"("criado_em");
