-- AlterTable
ALTER TABLE "User" ADD COLUMN "tourCompletedAt" TIMESTAMP(3);

-- Backfill existing users so they are considered already completed
UPDATE "User" SET "tourCompletedAt" = CURRENT_TIMESTAMP WHERE "tourCompletedAt" IS NULL;
