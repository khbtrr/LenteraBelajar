'use server';

import { db } from '@/lib/db';
import { requireSchool, requireRole, hashPassword } from '@/lib/auth-utils';
import { generateDefaultPassword } from '@/lib/password-policy';
import { recordAuditLog } from '@/lib/audit-log';
import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

const userSelect = {
  id: true, name: true, email: true, role: true, nis: true, nip: true, avatar: true,
  isActive: true, schoolId: true, createdAt: true, lastLoginAt: true, lockedUntil: true,
  failedLoginAttempts: true, lockoutCount: true,
  school: { select: { id: true, name: true, code: true } },
  assignedSchools: { select: { id: true, schoolId: true, school: { select: { id: true, name: true, code: true } } } },
} satisfies Prisma.UserSelect;

export async function getUsersInSchool(role?: Role) {
  await requireRole('ADMIN', 'SUPER_ADMIN');
  const session = await requireSchool();
  return db.user.findMany({
    where: {
      OR: [
        { schoolId: session.schoolId },
        { assignedSchools: { some: { schoolId: session.schoolId } } },
      ],
      ...(role && { role }),
    },
    select: userSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export async function createUser(data: {
  name: string;
  email: string;
  role: Role;
  nis?: string;
  nip?: string;
  assignedSchoolIds?: string[];
}) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');
  if (session.user.role !== 'SUPER_ADMIN' && data.assignedSchoolIds?.some((id) => id !== schoolId)) {
    throw new Error('Akses ditolak: Hanya Super Admin dapat menetapkan sekolah');
  }

  // Cegah eskalasi wewenang: Admin sekolah dilarang membuat Super Admin
  if (session.user.role !== 'SUPER_ADMIN' && data.role === Role.SUPER_ADMIN) {
    throw new Error('Akses ditolak: Admin sekolah tidak dapat membuat akun dengan peran Super Admin.');
  }

  // Generate compliant default password
  const initialPassword = generateDefaultPassword(data.nis || data.nip);
  const passwordHash = hashPassword(initialPassword);

  const user = await db.user.create({
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      nis: data.nis || null,
      nip: data.nip || null,
      passwordHash,
      mustChangePassword: true,
      schoolId,
      isActive: true,
    },
    select: userSelect,
  });

  // Hubungkan ke sekolah yang dipilih atau default ke schoolId saat ini
  const targetSchoolIds = data.assignedSchoolIds && data.assignedSchoolIds.length > 0
    ? Array.from(new Set([...data.assignedSchoolIds, schoolId]))
    : [schoolId];

  for (const sId of targetSchoolIds) {
    await db.userSchool.upsert({
      where: { userId_schoolId: { userId: user.id, schoolId: sId } },
      update: {},
      create: { userId: user.id, schoolId: sId },
    });
  }

  revalidatePath('/[locale]/admin/users', 'page');
  return user;
}

export async function bulkImportUsers(
  usersList: {
    name: string;
    email: string;
    role: Role;
    nis?: string;
    nip?: string;
    className?: string;
    cohortName?: string;
  }[]
) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  // Preload existing cohorts for this school to avoid redundant queries
  const existingCohorts = await db.cohort.findMany({
    where: { schoolId },
    select: { id: true, name: true },
  });
  const cohortCache = new Map<string, string>(); // lowercase name -> cohort id
  existingCohorts.forEach((c) => cohortCache.set(c.name.trim().toLowerCase(), c.id));

  let successCount = 0;
  let cohortAssignedCount = 0;

  for (const item of usersList) {
    if (!item.email || !item.name) continue;
    const existingUser = await db.user.findUnique({ where: { email: item.email.trim().toLowerCase() } });
    if (existingUser && (existingUser.role === 'SUPER_ADMIN' || existingUser.schoolId !== schoolId)) {
      throw new Error(`Gagal mengimpor: Email ${item.email} sudah terdaftar`);
    }
    if (session.user.role !== 'SUPER_ADMIN' && item.role === 'SUPER_ADMIN') {
      throw new Error('Akses ditolak: Peran Super Admin tidak dapat diimpor');
    }
  }

  for (const item of usersList) {
    if (!item.email || !item.name) continue;

    const initialPassword = generateDefaultPassword(item.nis || item.nip);
    const passwordHash = hashPassword(initialPassword);

    const targetRole =
      session.user.role !== 'SUPER_ADMIN' && item.role === Role.SUPER_ADMIN
        ? Role.STUDENT
        : item.role || Role.STUDENT;

    const existingNow = await db.user.findUnique({ where: { email: item.email.trim().toLowerCase() } });
    if (existingNow && (existingNow.schoolId !== schoolId || existingNow.role === 'SUPER_ADMIN' || existingNow.role !== targetRole)) {
      throw new Error(`Gagal mengimpor: Email ${item.email} sudah terdaftar atau peran tidak sesuai`);
    }
    const user = existingNow ? await db.user.update({
      where: { id: existingNow.id, schoolId, role: { not: 'SUPER_ADMIN' } },
      data: { name: item.name, nis: item.nis ?? null, nip: item.nip ?? null },
    }) : await db.user.create({
      data: {
        name: item.name,
        email: item.email.trim().toLowerCase(),
        role: targetRole,
        nis: item.nis || null,
        nip: item.nip || null,
        passwordHash,
        mustChangePassword: true,
        schoolId,
        isActive: true,
      },
    });
    successCount++;

    // Process cohort / class assignment if provided and user is a student
    const targetCohortName = (item.className || item.cohortName || '').trim();
    if (targetCohortName && user.role === Role.STUDENT) {
      const lowerName = targetCohortName.toLowerCase();
      let cohortId = cohortCache.get(lowerName);

      if (!cohortId) {
        // Create new cohort automatically
        const newCohort = await db.cohort.create({
          data: {
            name: targetCohortName,
            schoolId,
            isActive: true,
          },
        });
        cohortId = newCohort.id;
        cohortCache.set(lowerName, cohortId);
      }

      // Assign student to cohort
      await db.cohortMember.upsert({
        where: {
          cohortId_userId: {
            cohortId,
            userId: user.id,
          },
        },
        create: {
          cohortId,
          userId: user.id,
        },
        update: {},
      });
      cohortAssignedCount++;
    }
  }

  revalidatePath('/[locale]/admin/users', 'page');
  revalidatePath('/[locale]/admin/cohorts', 'page');
  return { success: true, count: successCount, cohortAssignedCount };
}

export async function toggleUserActive(userId: string) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  const user = await db.user.findUnique({ where: { id: userId, schoolId } });
  if (!user) throw new Error('User not found');

  const updated = await db.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive, sessionVersion: { increment: 1 } },
    select: userSelect,
  });

  await recordAuditLog({
    action: 'USER_STATUS_TOGGLE',
    userId: user.id,
    userEmail: user.email,
    details: `User status changed to ${!user.isActive ? 'ACTIVE' : 'INACTIVE'} by admin (${session.user.email})`,
  });

  revalidatePath('/[locale]/admin/users', 'page');
  return updated;
}

export async function resetUserPassword(userId: string) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  const user = await db.user.findUnique({ where: { id: userId, schoolId } });
  if (!user) throw new Error('User not found');

  const defaultPwd = generateDefaultPassword(user.nis || user.nip);
  const passwordHash = hashPassword(defaultPwd);

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
    },
    select: userSelect,
  });

  await recordAuditLog({
    action: 'USER_PASSWORD_RESET',
    userId: user.id,
    userEmail: user.email,
    details: `Password reset by admin (${session.user.email}) for user ${user.email} (${user.id})`,
  });

  revalidatePath('/[locale]/admin/users', 'page');
  return updated;
}

export async function updateUser(
  userId: string,
  data: {
    name: string;
    email: string;
    role: Role;
    nis?: string | null;
    nip?: string | null;
    isActive?: boolean;
    assignedSchoolIds?: string[];
  }
) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { assignedSchools: true },
  });
  if (!user) throw new Error('Pengguna tidak ditemukan');

  if (session.user.role !== 'SUPER_ADMIN' && data.assignedSchoolIds !== undefined) {
    const before = user.assignedSchools.map((assignment) => assignment.schoolId).sort();
    const after = [...new Set(data.assignedSchoolIds)].sort();
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error('Akses ditolak: Hanya Super Admin dapat mengubah assignment sekolah');
    }
  }

  if (session.user.role !== 'SUPER_ADMIN') {
    // Cegah eskalasi wewenang: Admin sekolah dilarang mengubah role menjadi atau dari Super Admin
    if (data.role === Role.SUPER_ADMIN || user.role === Role.SUPER_ADMIN) {
      throw new Error('Akses ditolak: Admin sekolah tidak dapat mengubah pengguna dengan peran Super Admin.');
    }
    if (user.schoolId !== schoolId) throw new Error('Akses ditolak: Perubahan akun utama sekolah lain memerlukan Super Admin');
  }

  if (data.email !== user.email) {
    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing && existing.id !== userId) {
      throw new Error('Email sudah digunakan oleh pengguna lain');
    }
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      nis: data.nis !== undefined ? (data.nis || null) : user.nis,
      nip: data.nip !== undefined ? (data.nip || null) : user.nip,
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.role !== user.role || (data.isActive !== undefined && data.isActive !== user.isActive) || (data.assignedSchoolIds !== undefined && session.user.role === 'SUPER_ADMIN') ? { sessionVersion: { increment: 1 } } : {}),
    },
    select: userSelect,
  });

  if (data.assignedSchoolIds && session.user.role === 'SUPER_ADMIN') {
    await db.userSchool.deleteMany({
      where: {
        userId,
        schoolId: { notIn: data.assignedSchoolIds },
      },
    });

    for (const sId of data.assignedSchoolIds) {
      await db.userSchool.upsert({
        where: { userId_schoolId: { userId, schoolId: sId } },
        update: {},
        create: { userId, schoolId: sId },
      });
    }
  }

  revalidatePath('/[locale]/admin/users', 'page');
  return updated;
}

export async function deleteUser(userId: string, hardDelete = false) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  const user = await db.user.findUnique({ where: { id: userId, schoolId } });
  if (!user) throw new Error('Pengguna tidak ditemukan');

  if (user.id === session.user.id) {
    throw new Error('Anda tidak dapat menghapus akun Anda sendiri');
  }

  if (hardDelete) {
    try {
      await db.user.delete({
        where: { id: userId },
      });
      await recordAuditLog({
        action: 'USER_DELETED',
        userId: user.id,
        userEmail: user.email,
        details: `User hard-deleted by admin (${session.user.email})`,
      });
      revalidatePath('/[locale]/admin/users', 'page');
      return { success: true, mode: 'deleted' as const };
    } catch (err: any) {
      await db.user.update({
        where: { id: userId },
        data: { isActive: false, sessionVersion: { increment: 1 } },
      });
      await recordAuditLog({
        action: 'USER_STATUS_TOGGLE',
        userId: user.id,
        userEmail: user.email,
        details: `User deactivated due to academic foreign key constraints by admin (${session.user.email})`,
      });
      revalidatePath('/[locale]/admin/users', 'page');
      return {
        success: true,
        mode: 'deactivated' as const,
        message: 'Pengguna memiliki data riwayat pembelajaran/akademik. Pengguna dialihkan ke status Nonaktif untuk menjaga integritas data.',
      };
    }
  } else {
    await db.user.update({
      where: { id: userId },
      data: { isActive: false, sessionVersion: { increment: 1 } },
    });
    await recordAuditLog({
      action: 'USER_DELETED',
      userId: user.id,
      userEmail: user.email,
      details: `User soft-deleted (deactivated) by admin (${session.user.email})`,
    });
    revalidatePath('/[locale]/admin/users', 'page');
    return { success: true, mode: 'deactivated' as const };
  }
}
