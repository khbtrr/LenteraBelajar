'use server';

import { db } from '@/lib/db';
import { requireSchool, requireRole, hashPassword } from '@/lib/auth-utils';
import { generateDefaultPassword } from '@/lib/password-policy';
import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getUsersInSchool(role?: Role) {
  const session = await requireSchool();
  return db.user.findMany({
    where: {
      OR: [
        { schoolId: session.schoolId },
        { assignedSchools: { some: { schoolId: session.schoolId } } },
      ],
      ...(role && { role }),
    },
    include: {
      school: { select: { id: true, name: true, code: true } },
      assignedSchools: {
        include: {
          school: { select: { id: true, name: true, code: true } },
        },
      },
    },
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

    const initialPassword = generateDefaultPassword(item.nis || item.nip);
    const passwordHash = hashPassword(initialPassword);

    const user = await db.user.upsert({
      where: { email: item.email },
      create: {
        name: item.name,
        email: item.email,
        role: item.role || Role.STUDENT,
        nis: item.nis || null,
        nip: item.nip || null,
        passwordHash,
        mustChangePassword: true,
        schoolId,
        isActive: true,
      },
      update: {
        name: item.name,
        nis: item.nis || null,
        nip: item.nip || null,
      },
    });
    successCount++;

    // Process cohort / class assignment if provided and user is a student
    const targetCohortName = (item.className || item.cohortName || '').trim();
    if (targetCohortName && (item.role === Role.STUDENT || !item.role)) {
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
    data: { isActive: !user.isActive },
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
    },
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

  if (session.user.role !== 'SUPER_ADMIN') {
    const isRelated = user.schoolId === schoolId || user.assignedSchools.some((as) => as.schoolId === schoolId);
    if (!isRelated) throw new Error('Anda tidak memiliki akses ke pengguna ini');
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
    },
    include: {
      school: { select: { id: true, name: true, code: true } },
      assignedSchools: {
        include: {
          school: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  if (data.assignedSchoolIds) {
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
      revalidatePath('/[locale]/admin/users', 'page');
      return { success: true, mode: 'deleted' as const };
    } catch (err: any) {
      await db.user.update({
        where: { id: userId },
        data: { isActive: false },
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
      data: { isActive: false },
    });
    revalidatePath('/[locale]/admin/users', 'page');
    return { success: true, mode: 'deactivated' as const };
  }
}
