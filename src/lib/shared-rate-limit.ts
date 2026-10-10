import 'server-only';
import { db } from '@/lib/db';
import type { RateLimitResult } from '@/lib/rate-limit';

export async function checkSharedRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const requestedAt = Date.now();
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "RateLimitBucket" ("key", "timestamps", "expiresAt") VALUES (${key}, ARRAY[]::timestamptz[], ${new Date(requestedAt + windowMs)}) ON CONFLICT ("key") DO NOTHING`;
    await tx.$queryRaw`SELECT "key" FROM "RateLimitBucket" WHERE "key" = ${key} FOR UPDATE`;
    const now = Date.now();
    const bucket = await tx.rateLimitBucket.findUniqueOrThrow({ where: { key } });
    const timestamps = bucket.timestamps.filter((time) => time.getTime() > now - windowMs);
    const resetInSeconds = timestamps.length ? Math.max(1, Math.ceil((timestamps[0].getTime() + windowMs - now) / 1000)) : Math.ceil(windowMs / 1000);
    if (timestamps.length >= limit) return { success: false, limit, remaining: 0, resetInSeconds };
    timestamps.push(new Date(now));
    await tx.rateLimitBucket.update({ where: { key }, data: { timestamps, expiresAt: new Date(now + windowMs) } });
    return { success: true, limit, remaining: limit - timestamps.length, resetInSeconds };
  }, { timeout: 15000, maxWait: 10000 });
}
