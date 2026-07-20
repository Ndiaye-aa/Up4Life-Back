-- Baseline migration: captures a column that already exists in the database
-- (added outside of Prisma's migration history) so `migrate dev` stops
-- reporting drift. This migration is marked as already applied via
-- `prisma migrate resolve --applied`, so it is never executed against data.
ALTER TABLE "item_treino" ADD COLUMN "obs" TEXT;
