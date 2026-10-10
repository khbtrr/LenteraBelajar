CREATE TABLE "RateLimitBucket" ("key" TEXT NOT NULL PRIMARY KEY, "timestamps" TIMESTAMP(3)[] NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");
