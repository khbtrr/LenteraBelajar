import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { finalizeSystemAttempt } from '@/lib/cbt';

export async function POST(request: NextRequest) {
  const expected = process.env.CBT_WORKER_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!expected || !supplied || Buffer.byteLength(expected) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT a."id" FROM "QuizAttempt" a JOIN "Quiz" q ON q."id" = a."quizId"
    WHERE a."submittedAt" IS NULL AND a."isVoided" = false AND
      (q."deadline" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') OR (q."duration" IS NOT NULL AND
        a."startedAt" + make_interval(mins => q."duration" + a."extraTimeMinutes") <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')))
    ORDER BY a."startedAt" LIMIT 100`;
  let finalized = 0, needsReview = 0;
  for (const row of rows) {
    try { await finalizeSystemAttempt(row.id, 'TIMEOUT'); finalized++; }
    catch (error) {
      if (error instanceof Error && error.message.startsWith('LEGACY_SNAPSHOT_REVIEW')) needsReview++;
      else throw error;
    }
  }
  await db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 600000) } } });
  return NextResponse.json({ finalized, needsReview });
}
