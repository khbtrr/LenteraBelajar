'use server';

import { db } from '@/lib/db';
import { requireSchool, requireRole, hashPassword } from '@/lib/auth-utils';
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

  // For students, default password is their NIS. Otherwise default to "Lentera123!"
  const initialPassword = data.role === Role.STUDENT && data.nis ? data.nis : 'Lentera123!';
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

    const initialPassword = item.role === Role.STUDENT && item.nis ? item.nis : 'Lentera123!';
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

  const defaultPwd = user.role === Role.STUDENT && user.nis ? user.nis : 'Lentera123!';
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
