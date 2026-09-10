'use server';

import { db } from '@/lib/db';
import { requireRole, requireSchool } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';
import { AcademicYearStatus, CourseStatus } from '@prisma/client';

export async function getAcademicYears() {
  const session = await requireSchool();
  return db.academicYear.findMany({
    where: { schoolId: session.schoolId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { courses: true },
      },
    },
  });
}

export async function createAcademicYear(data: {
  name: string;
  startDate: string;
  endDate: string;
  makeActive?: boolean;
}) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  if (data.makeActive) {
    // Archive any currently active academic year and its courses
    const activeYears = await db.academicYear.findMany({
      where: { schoolId, status: AcademicYearStatus.ACTIVE },
    });
    for (const year of activeYears) {
      await db.academicYear.update({
        where: { id: year.id },
        data: { status: AcademicYearStatus.ARCHIVED },
      });
      await db.course.updateMany({
        where: { academicYearId: year.id },
        data: { status: CourseStatus.ARCHIVED },
      });
    }
  }

  const newYear = await db.academicYear.create({
    data: {
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      status: data.makeActive ? AcademicYearStatus.ACTIVE : AcademicYearStatus.ACTIVE,
      schoolId,
    },
  });

  revalidatePath('/[locale]/admin/academic-years', 'page');
  return newYear;
}

export async function setActiveAcademicYear(id: string) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  // Set previous active years to archived and archive their courses
  const previousActive = await db.academicYear.findMany({
    where: { schoolId, status: AcademicYearStatus.ACTIVE, id: { not: id } },
  });

  for (const prev of previousActive) {
    await db.academicYear.update({
      where: { id: prev.id },
      data: { status: AcademicYearStatus.ARCHIVED },
    });
    await db.course.updateMany({
      where: { academicYearId: prev.id },
      data: { status: CourseStatus.ARCHIVED },
    });
  }

  // Activate the selected year
  const updated = await db.academicYear.update({
    where: { id, schoolId },
    data: { status: AcademicYearStatus.ACTIVE },
  });

  revalidatePath('/[locale]/admin/academic-years', 'page');
  return updated;
}

export async function archiveAcademicYear(id: string) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  const updated = await db.academicYear.update({
    where: { id, schoolId },
    data: { status: AcademicYearStatus.ARCHIVED },
  });

  // Archive all courses under this year automatically
  await db.course.updateMany({
    where: { academicYearId: id, schoolId },
    data: { status: CourseStatus.ARCHIVED },
  });

  revalidatePath('/[locale]/admin/academic-years', 'page');
  return updated;
}
