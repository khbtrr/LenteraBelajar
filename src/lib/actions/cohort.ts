'use server';

import { db } from '@/lib/db';
import { requireSchool, requireRole } from '@/lib/auth-utils';
import { EnrollmentMethod, Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getCohorts() {
  const session = await requireSchool();
  return db.cohort.findMany({
    where: { schoolId: session.schoolId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, nis: true },
          },
        },
      },
      _count: {
        select: {
          members: true,
          enrollments: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCohortById(id: string) {
  const session = await requireSchool();
  return db.cohort.findUnique({
    where: { id, schoolId: session.schoolId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, nis: true },
          },
        },
      },
    },
  });
}

export async function createCohort(name: string) {
  const session = await requireRole('ADMIN', 'TEACHER', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  const cohort = await db.cohort.create({
    data: {
      name,
      schoolId,
    },
  });

  revalidatePath('/[locale]/admin/cohorts', 'page');
  return cohort;
}

export async function addStudentToCohort(cohortId: string, userId: string) {
  await requireRole('ADMIN', 'TEACHER', 'SUPER_ADMIN');

  const membership = await db.cohortMember.upsert({
    where: {
      cohortId_userId: {
        cohortId,
        userId,
      },
    },
    create: {
      cohortId,
      userId,
    },
    update: {},
  });

  revalidatePath('/[locale]/admin/cohorts', 'page');
  return membership;
}

export async function removeStudentFromCohort(cohortId: string, userId: string) {
  await requireRole('ADMIN', 'TEACHER', 'SUPER_ADMIN');

  const deleted = await db.cohortMember.delete({
    where: {
      cohortId_userId: {
        cohortId,
        userId,
      },
    },
  });

  revalidatePath('/[locale]/admin/cohorts', 'page');
  return deleted;
}

export async function getStudentsInSchool() {
  const session = await requireSchool();
  return db.user.findMany({
    where: {
      schoolId: session.schoolId,
      role: Role.STUDENT,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      nis: true,
    },
    orderBy: { name: 'asc' },
  });
}

export async function syncCohortToCourse(courseId: string, cohortId: string) {
  await requireRole('ADMIN', 'TEACHER', 'SUPER_ADMIN');

  // Get all members of the cohort
  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    include: {
      members: true,
    },
  });

  if (!cohort) throw new Error('Cohort not found');

  let enrolledCount = 0;
  for (const member of cohort.members) {
    await db.enrollment.upsert({
      where: {
        courseId_userId: {
          courseId,
          userId: member.userId,
        },
      },
      create: {
        courseId,
        userId: member.userId,
        cohortId,
        method: EnrollmentMethod.COHORT_SYNC,
      },
      update: {
        cohortId,
        method: EnrollmentMethod.COHORT_SYNC,
      },
    });
    enrolledCount++;
  }

  revalidatePath('/[locale]/teacher/course/[courseId]/enrollments', 'page');
  revalidatePath('/[locale]/admin/courses', 'page');
  return { success: true, enrolledCount };
}

export async function manualEnrollStudent(courseId: string, userId: string) {
  await requireRole('ADMIN', 'TEACHER', 'SUPER_ADMIN');

  const enrollment = await db.enrollment.upsert({
    where: {
      courseId_userId: {
        courseId,
        userId,
      },
    },
    create: {
      courseId,
      userId,
      method: EnrollmentMethod.MANUAL,
    },
    update: {},
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/enrollments', 'page');
  return enrollment;
}

export async function removeEnrollment(courseId: string, userId: string) {
  await requireRole('ADMIN', 'TEACHER', 'SUPER_ADMIN');

  const deleted = await db.enrollment.delete({
    where: {
      courseId_userId: {
        courseId,
        userId,
      },
    },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/enrollments', 'page');
  return deleted;
}
