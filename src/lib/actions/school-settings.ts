'use server';

import { db } from '@/lib/db';
import { requireRole, verifyPassword, hashPassword } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';
import { AcademicYearStatus } from '@prisma/client';
import { assertFileReferences, bindFileReferences } from '@/lib/files';
import { validatePassword } from '@/lib/password-policy';
import { recordAuditLog } from '@/lib/audit-log';
import { recordFailedPassword } from '@/lib/login-security';

export async function getSchoolSettings() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) {
    throw new Error('Sekolah tidak ditemukan');
  }

  const [school, activeAcademicYear, adminUser] = await Promise.all([
    db.school.findUnique({
      where: { id: schoolId },
    }),
    db.academicYear.findFirst({
      where: { schoolId, status: AcademicYearStatus.ACTIVE },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        mustChangePassword: true,
      },
    }),
  ]);

  if (!school) {
    throw new Error('Data sekolah tidak ditemukan');
  }

  return {
    school,
    activeAcademicYear,
    adminUser,
  };
}

export async function updateSchoolProfile(data: {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  loginQuote?: string;
  loginQuoteAuthor?: string;
}) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('Sekolah tidak ditemukan');
  await assertFileReferences(data.logo);

  // Check code uniqueness if changed
  if (data.code) {
    const existing = await db.school.findFirst({
      where: {
        code: data.code.trim(),
        NOT: { id: schoolId },
      },
    });
    if (existing) {
      throw new Error(`Kode/NPSN "${data.code}" sudah digunakan oleh sekolah lain`);
    }
  }

  const updatedSchool = await db.school.update({
    where: { id: schoolId },
    data: {
      name: data.name.trim(),
      code: data.code.trim(),
      address: data.address?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      website: data.website?.trim() || null,
      logo: data.logo || null,
      loginQuote: data.loginQuote?.trim() || null,
      loginQuoteAuthor: data.loginQuoteAuthor?.trim() || null,
    },
  });

  revalidatePath('/[locale]/admin/settings', 'page');
  revalidatePath('/[locale]/admin', 'layout');
  revalidatePath('/[locale]/teacher', 'layout');
  revalidatePath('/[locale]/student', 'layout');
  revalidatePath('/[locale]/login', 'page');

  await bindFileReferences('LOGO', schoolId, data.logo);
  return updatedSchool;
}

export async function updateAcademicSettings(data: {
  defaultPassingGrade: number;
}) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('Sekolah tidak ditemukan');

  if (data.defaultPassingGrade < 0 || data.defaultPassingGrade > 100) {
    throw new Error('KKM harus berada di antara rentang 0 hingga 100');
  }

  const updatedSchool = await db.school.update({
    where: { id: schoolId },
    data: {
      defaultPassingGrade: data.defaultPassingGrade,
    },
  });

  revalidatePath('/[locale]/admin/settings', 'page');
  return updatedSchool;
}

export async function updateCbtSettings(data: {
  cbtLockdownEnabled: boolean;
  cbtMaxTabSwitches: number;
  cbtRequireToken: boolean;
  cbtShuffleQuestions: boolean;
  cbtShuffleOptions: boolean;
}) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('Sekolah tidak ditemukan');

  if (data.cbtMaxTabSwitches < 1 || data.cbtMaxTabSwitches > 20) {
    throw new Error('Toleransi pindah tab harus antara 1 dan 20');
  }

  const updatedSchool = await db.school.update({
    where: { id: schoolId },
    data: {
      cbtLockdownEnabled: data.cbtLockdownEnabled,
      cbtMaxTabSwitches: data.cbtMaxTabSwitches,
      cbtRequireToken: data.cbtRequireToken,
      cbtShuffleQuestions: data.cbtShuffleQuestions,
      cbtShuffleOptions: data.cbtShuffleOptions,
    },
  });

  revalidatePath('/[locale]/admin/settings', 'page');
  return updatedSchool;
}

export async function updateAdminProfile(data: {
  name: string;
  email: string;
}) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const userId = session.user.id;

  const trimmedEmail = data.email.trim().toLowerCase();
  const trimmedName = data.name.trim();

  if (!trimmedName || !trimmedEmail) {
    throw new Error('Nama dan email wajib diisi');
  }

  const existing = await db.user.findFirst({
    where: {
      email: trimmedEmail,
      NOT: { id: userId },
    },
  });

  if (existing) {
    throw new Error(`Email "${trimmedEmail}" sudah digunakan oleh akun lain`);
  }

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: {
      name: trimmedName,
      email: trimmedEmail,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  revalidatePath('/[locale]/admin/settings', 'page');
  return updatedUser;
}

export async function updateAdminPassword(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const userId = session.user.id;

  if (!data.currentPassword || !data.newPassword || !data.confirmPassword) {
    throw new Error('Semua kolom kata sandi wajib diisi');
  }

  if (data.newPassword !== data.confirmPassword) {
    throw new Error('Konfirmasi kata sandi baru tidak cocok');
  }

  const validation = validatePassword(data.newPassword);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Kata sandi tidak memenuhi kebijakan keamanan');
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, passwordHash: true, lockedUntil: true },
  });

  if (!user) {
    throw new Error('Pengguna tidak ditemukan');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remainingMinutes = Math.max(
      1,
      Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000))
    );
    throw new Error(`Akun sedang dikunci sementara selama ${remainingMinutes} menit karena terlalu banyak percobaan gagal.`);
  }

  const isCurrentValid = verifyPassword(data.currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    const failure = await recordFailedPassword(user.id);
    await recordAuditLog({
      action: failure.lockoutMinutes ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
      userId: user.id,
      userEmail: user.email,
      details: `Percobaan gagal ganti kata sandi admin. Percobaan ${failure.failed}/5`,
    });

    if (failure.lockoutMinutes) {
      throw new Error(`Terlalu banyak percobaan gagal. Akun dikunci sementara selama ${failure.lockoutMinutes} menit.`);
    }

    throw new Error(`Kata sandi saat ini tidak tepat. Sisa percobaan: ${Math.max(0, 5 - failure.failed)}`);
  }

  const newHash = hashPassword(data.newPassword);

  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: newHash,
      sessionVersion: { increment: 1 },
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await recordAuditLog({
    action: 'PASSWORD_CHANGED',
    userId: user.id,
    userEmail: user.email,
    details: 'Kata sandi administrator diperbarui melalui pengaturan sekolah',
  });

  revalidatePath('/[locale]/admin/settings', 'page');
  return { success: true };
}
