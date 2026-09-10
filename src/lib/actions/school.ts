'use server';

import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';

export async function getSchools() {
  await requireRole('SUPER_ADMIN');
  return db.school.findMany({
    include: {
      _count: {
        select: {
          users: true,
          courses: true,
          academicYears: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createSchool(data: {
  name: string;
  code: string;
  address?: string;
}) {
  await requireRole('SUPER_ADMIN');

  const school = await db.school.create({
    data: {
      name: data.name,
      code: data.code.toUpperCase().trim(),
      address: data.address || null,
      isActive: true,
    },
  });

  revalidatePath('/[locale]/platform/schools', 'page');
  return school;
}

export async function toggleSchoolActive(schoolId: string) {
  await requireRole('SUPER_ADMIN');

  const school = await db.school.findUnique({ where: { id: schoolId } });
  if (!school) throw new Error('School not found');

  const updated = await db.school.update({
    where: { id: schoolId },
    data: { isActive: !school.isActive },
  });

  revalidatePath('/[locale]/platform/schools', 'page');
  return updated;
}
