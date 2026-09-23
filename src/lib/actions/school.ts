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

import { cookies } from 'next/headers';
import { requireAuth, getActiveSchoolId } from '@/lib/auth-utils';

export async function getUserSchools() {
  const session = await requireAuth();
  const activeId = await getActiveSchoolId();

  // Jika SUPER_ADMIN, bisa mengakses semua sekolah aktif
  if (session.user.role === 'SUPER_ADMIN') {
    const allSchools = await db.school.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      currentSchoolId: activeId || allSchools[0]?.id || null,
      schools: allSchools,
      canSwitch: allSchools.length > 1,
    };
  }

  // Cari sekolah dari user.schoolId dan user.assignedSchools
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      schoolId: true,
      school: { select: { id: true, name: true, code: true } },
      assignedSchools: {
        include: {
          school: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  const schoolsMap = new Map<string, { id: string; name: string; code: string }>();

  if (user?.school) {
    schoolsMap.set(user.school.id, user.school);
  }

  user?.assignedSchools.forEach((as) => {
    if (as.school) {
      schoolsMap.set(as.school.id, as.school);
    }
  });

  const schools = Array.from(schoolsMap.values());

  return {
    currentSchoolId: activeId || schools[0]?.id || null,
    schools,
    canSwitch: schools.length > 1,
  };
}

export async function switchActiveSchool(schoolId: string) {
  const session = await requireAuth();

  // Validasi hak akses
  if (session.user.role !== 'SUPER_ADMIN') {
    const isPrimary = session.user.schoolId === schoolId;
    const hasAssignment = await db.userSchool.findUnique({
      where: {
        userId_schoolId: {
          userId: session.user.id,
          schoolId,
        },
      },
    });

    if (!isPrimary && !hasAssignment) {
      throw new Error('Anda tidak memiliki akses ke sekolah ini');
    }
  }

  const cookieStore = await cookies();
  cookieStore.set('active_school_id', schoolId, {
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 hari
    sameSite: 'lax',
  });

  revalidatePath('/', 'layout');
  return { success: true, schoolId };
}

export async function getActiveSchoolDetail() {
  const activeId = await getActiveSchoolId();
  if (!activeId) return null;

  return db.school.findUnique({
    where: { id: activeId },
    select: {
      id: true,
      name: true,
      code: true,
      address: true,
      email: true,
      phone: true,
    },
  });
}

export async function getAllActiveSchools() {
  return db.school.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: { createdAt: 'asc' },
  });
}
