import 'server-only';
import type { Prisma } from '@prisma/client';
import { calculateLevelInfo } from '@/lib/gamification-constants';

export async function awardXpInTransaction(tx: Prisma.TransactionClient, data: {
  userId: string; amount: number; eventKey: string; reason: string; actionType: string; courseId?: string;
}) {
  if (!Number.isSafeInteger(data.amount) || data.amount <= 0 || !data.eventKey) throw new Error('Reward tidak valid');
  const inserted = await tx.xpLog.createMany({ data: [data], skipDuplicates: true });
  if (!inserted.count) return null;
  const user = await tx.user.update({ where: { id: data.userId }, data: { xp: { increment: data.amount } }, select: { xp: true } });
  await tx.user.update({ where: { id: data.userId }, data: { level: calculateLevelInfo(user.xp).level } });
  return { oldLevel: calculateLevelInfo(user.xp - data.amount).level, newLevel: calculateLevelInfo(user.xp).level };
}
