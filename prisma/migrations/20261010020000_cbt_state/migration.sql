ALTER TABLE "QuizAttempt" ADD COLUMN "isVoided" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "QuizAttempt_one_active_per_student" ON "QuizAttempt"("quizId", "userId")
WHERE "submittedAt" IS NULL AND "isVoided" = false;
