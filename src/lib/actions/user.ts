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
      schoolId: session.schoolId,
      ...(role && { role }),
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
  }[]
) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  let successCount = 0;
  for (const item of usersList) {
    if (!item.email || !item.name) continue;

    const initialPassword = generateDefaultPassword(item.nis || item.nip);
    const passwordHash = hashPassword(initialPassword);

    await db.user.upsert({
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
  }

  revalidatePath('/[locale]/admin/users', 'page');
  return { success: true, count: successCount };
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
  }
) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  const user = await db.user.findUnique({ where: { id: userId, schoolId } });
  if (!user) throw new Error('Pengguna tidak ditemukan');

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
  });

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
