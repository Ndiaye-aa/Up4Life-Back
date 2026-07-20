-- AlterTable
ALTER TABLE "push_subscription" ALTER COLUMN "id_aluno" DROP NOT NULL;
ALTER TABLE "push_subscription" ADD COLUMN     "id_personal" INTEGER;

-- AddForeignKey
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_id_personal_fkey" FOREIGN KEY ("id_personal") REFERENCES "personal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
