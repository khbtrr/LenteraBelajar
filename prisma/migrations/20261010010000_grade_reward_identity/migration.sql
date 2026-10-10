ALTER TABLE "Grade" ADD COLUMN "resourceKey" TEXT;
ALTER TABLE "Grade" ADD COLUMN "includeInAverage" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Grade_courseId_userId_resourceKey_key" ON "Grade"("courseId", "userId", "resourceKey");
ALTER TABLE "XpLog" ADD COLUMN "eventKey" TEXT;
CREATE UNIQUE INDEX "XpLog_eventKey_key" ON "XpLog"("eventKey");
