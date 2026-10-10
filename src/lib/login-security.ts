import 'server-only';
import { db } from '@/lib/db';

export async function recordFailedPassword(userId: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) return { failed: user.failedLoginAttempts, lockoutMinutes: Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000), lockoutCount: user.lockoutCount };
    const failed = user.lockedUntil ? 1 : user.failedLoginAttempts + 1;
    const lockoutCount = failed >= 5 ? user.lockoutCount + 1 : user.lockoutCount;
    const lockoutMinutes = failed >= 5 ? lockoutCount >= 3 ? 60 : 15 : 0;
    await tx.user.update({ where: { id: userId }, data: { failedLoginAttempts: failed, lockoutCount, lockedUntil: lockoutMinutes ? new Date(Date.now() + lockoutMinutes * 60000) : null } });
    return { failed, lockoutMinutes, lockoutCount };
  });
}
