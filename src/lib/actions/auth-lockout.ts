'use server';

import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-utils';
import { recordAuditLog } from '@/lib/audit-log';
import { revalidatePath } from 'next/cache';

export interface LockoutStatus {
  isLocked: boolean;
  remainingMinutes: number;
  failedAttempts: number;
  maxAttempts: number;
}

/**
 * Check lockout status and failed attempt count for a given email address
 * Used by login form to display clear user-friendly error messages
 */
export async function getAccountLockoutStatus(email: string): Promise<LockoutStatus> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return { isLocked: false, remainingMinutes: 0, failedAttempts: 0, maxAttempts: 5 };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: cleanEmail },
      select: {
        lockedUntil: true,
        failedLoginAttempts: true,
      },
    });

    if (!user) {
      return { isLocked: false, remainingMinutes: 0, failedAttempts: 0, maxAttempts: 5 };
    }

    const isLocked = Boolean(user.lockedUntil && user.lockedUntil > new Date());
    const remainingMinutes = isLocked
      ? Math.max(1, Math.ceil((user.lockedUntil!.getTime() - Date.now()) / (60 * 1000)))
      : 0;

    return {
      isLocked,
      remainingMinutes,
      failedAttempts: user.failedLoginAttempts || 0,
      maxAttempts: 5,
    };
  } catch {
    return { isLocked: false, remainingMinutes: 0, failedAttempts: 0, maxAttempts: 5 };
  }
}

/**
 * Unlock a user account manually (Admin / Super Admin only)
 */
export async function unlockUserAccount(userId: string): Promise<{ success: boolean; message: string }> {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, schoolId: true },
  });

  if (!user) {
    throw new Error('Pengguna tidak ditemukan');
  }

  // Multi-tenant check: ADMIN can only unlock users within their school
  if (session.user.role === 'ADMIN' && user.schoolId !== session.user.schoolId) {
    throw new Error('Tidak memiliki akses untuk membuka akun pengguna ini');
  }

  await db.user.update({
    where: { id: userId },
    data: {
      lockedUntil: null,
      failedLoginAttempts: 0,
      lockoutCount: 0,
    },
  });

  await recordAuditLog({
    action: 'ACCOUNT_UNLOCKED',
    userId: user.id,
    userEmail: user.email,
    details: `Account unlocked manually by ${session.user.name} (${session.user.email})`,
  });

  revalidatePath('/[locale]/admin/users', 'page');

  return { success: true, message: `Akun ${user.name} berhasil dibuka` };
}
