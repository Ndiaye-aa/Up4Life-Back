-- AlterTable
ALTER TABLE "agenda_treino" ADD COLUMN "dias_desde" JSONB NOT NULL DEFAULT '{}';

-- Backfill: os dias que já estão na agenda valem desde o início do acompanhamento.
UPDATE "agenda_treino"
SET "dias_desde" = COALESCE(
  (
    SELECT jsonb_object_agg(d::text, to_char("acompanhamento_desde", 'YYYY-MM-DD'))
    FROM unnest("dias") AS d
  ),
  '{}'::jsonb
);
