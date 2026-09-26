'use server';

import { db } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/auth-utils';
import { AccessItemType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export interface ItemCohortAccessInfo {
  itemId: string;
  itemType: AccessItemType;
  title: string;
  allowedCohorts: Array<{ id: string; name: string }>;
  overrides: Array<{ id: string; userId: string; name: string; nis: string | null }>;
}

export interface ModuleAccessSettings {
  moduleId: string;
  moduleTitle: string;
  courseId: string;
  quizzes: ItemCohortAccessInfo[];
  assignments: ItemCohortAccessInfo[];
  contents: ItemCohortAccessInfo[];
}

/**
 * Check whether a student has access to an item (Quiz, Assignment, Content).
 * Returns true if:
 * 1. The item has no cohort restrictions (open by default), OR
 * 2. The user has an individual override (ItemAccessOverride), OR
 * 3. The user belongs to one of the allowed cohorts.
 */
export async function checkStudentItemAccess({
  userId,
  itemType,
  itemId,
  courseId,
}: {
  userId: string;
  itemType: AccessItemType;
  itemId: string;
  courseId?: string;
}): Promise<boolean> {
  // 1. Fetch cohort access entries for this item
  let allowedCohortIds: string[] = [];

  if (itemType === 'QUIZ') {
    const access = await db.quizCohortAccess.findMany({
      where: { quizId: itemId },
      select: { cohortId: true },
    });
    allowedCohortIds = access.map((a) => a.cohortId);
  } else if (itemType === 'ASSIGNMENT') {
    const access = await db.assignmentCohortAccess.findMany({
      where: { assignmentId: itemId },
      select: { cohortId: true },
    });
    allowedCohortIds = access.map((a) => a.cohortId);
  } else if (itemType === 'CONTENT') {
    const access = await db.contentCohortAccess.findMany({
      where: { contentId: itemId },
      select: { cohortId: true },
    });
    allowedCohortIds = access.map((a) => a.cohortId);
  }

  // If no cohort restrictions configured, it is open to all enrolled students
  if (allowedCohortIds.length === 0) {
    return true;
  }

  // 2. Check individual override
  const override = await db.itemAccessOverride.findUnique({
    where: {
      itemType_itemId_userId: {
        itemType,
        itemId,
        userId,
      },
    },
  });

  if (override) {
    return true;
  }

  // 3. Check user cohort memberships
  // User might have cohortId on Enrollment or in CohortMember
  const [enrollment, cohortMemberships] = await Promise.all([
    courseId
      ? db.enrollment.findUnique({
          where: { courseId_userId: { courseId, userId } },
          select: { cohortId: true },
        })
      : db.enrollment.findFirst({
          where: { userId, cohortId: { in: allowedCohortIds } },
          select: { cohortId: true },
        }),
    db.cohortMember.findMany({
      where: { userId, cohortId: { in: allowedCohortIds } },
      select: { cohortId: true },
    }),
  ]);

  if (enrollment?.cohortId && allowedCohortIds.includes(enrollment.cohortId)) {
    return true;
  }

  if (cohortMemberships.length > 0) {
    return true;
  }

  return false;
}

/**
 * Get all cohort access and override settings for a module's contents, quizzes, and assignments.
 */
export async function getCohortAccessForModule(moduleId: string): Promise<ModuleAccessSettings> {
  await requireAuth();

  const moduleData = await db.module.findUnique({
    where: { id: moduleId },
    include: {
      contents: {
        orderBy: { order: 'asc' },
        include: {
          cohortAccess: {
            include: { cohort: { select: { id: true, name: true } } },
          },
        },
      },
      quizzes: {
        orderBy: { order: 'asc' },
        include: {
          cohortAccess: {
            include: { cohort: { select: { id: true, name: true } } },
          },
        },
      },
      assignments: {
        orderBy: { order: 'asc' },
        include: {
          cohortAccess: {
            include: { cohort: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  if (!moduleData) {
    throw new Error('Modul tidak ditemukan');
  }

  const allItemIds = [
    ...moduleData.contents.map((c) => ({ id: c.id, type: AccessItemType.CONTENT })),
    ...moduleData.quizzes.map((q) => ({ id: q.id, type: AccessItemType.QUIZ })),
    ...moduleData.assignments.map((a) => ({ id: a.id, type: AccessItemType.ASSIGNMENT })),
  ];

  // Fetch all overrides for these items
  const overrides = await db.itemAccessOverride.findMany({
    where: {
      OR: allItemIds.map((item) => ({
        itemId: item.id,
        itemType: item.type,
      })),
    },
    include: {
      user: {
        select: { id: true, name: true, nis: true },
      },
    },
  });

  const overrideMap = new Map<string, Array<{ id: string; userId: string; name: string; nis: string | null }>>();
  for (const o of overrides) {
    const key = `${o.itemType}_${o.itemId}`;
    const list = overrideMap.get(key) || [];
    list.push({
      id: o.id,
      userId: o.user.id,
      name: o.user.name,
      nis: o.user.nis,
    });
    overrideMap.set(key, list);
  }

  return {
    moduleId: moduleData.id,
    moduleTitle: moduleData.title,
    courseId: moduleData.courseId,
    contents: moduleData.contents.map((c) => ({
      itemId: c.id,
      itemType: AccessItemType.CONTENT,
      title: c.title,
      allowedCohorts: c.cohortAccess.map((ca) => ({
        id: ca.cohort.id,
        name: ca.cohort.name,
      })),
      overrides: overrideMap.get(`${AccessItemType.CONTENT}_${c.id}`) || [],
    })),
    quizzes: moduleData.quizzes.map((q) => ({
      itemId: q.id,
      itemType: AccessItemType.QUIZ,
      title: q.title,
      allowedCohorts: q.cohortAccess.map((ca) => ({
        id: ca.cohort.id,
        name: ca.cohort.name,
      })),
      overrides: overrideMap.get(`${AccessItemType.QUIZ}_${q.id}`) || [],
    })),
    assignments: moduleData.assignments.map((a) => ({
      itemId: a.id,
      itemType: AccessItemType.ASSIGNMENT,
      title: a.title,
      allowedCohorts: a.cohortAccess.map((ca) => ({
        id: ca.cohort.id,
        name: ca.cohort.name,
      })),
      overrides: overrideMap.get(`${AccessItemType.ASSIGNMENT}_${a.id}`) || [],
    })),
  };
}

/**
 * Set cohort access for a specific item (Quiz, Assignment, or Content).
 * Passing an empty cohortIds array removes all restrictions (restores open access).
 */
export async function setCohortAccess(
  itemType: AccessItemType,
  itemId: string,
  cohortIds: string[]
) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const uniqueCohortIds = Array.from(new Set(cohortIds));

  await db.$transaction(async (tx) => {
    if (itemType === AccessItemType.QUIZ) {
      await tx.quizCohortAccess.deleteMany({ where: { quizId: itemId } });
      if (uniqueCohortIds.length > 0) {
        await tx.quizCohortAccess.createMany({
          data: uniqueCohortIds.map((cohortId) => ({ quizId: itemId, cohortId })),
        });
      }
    } else if (itemType === AccessItemType.ASSIGNMENT) {
      await tx.assignmentCohortAccess.deleteMany({ where: { assignmentId: itemId } });
      if (uniqueCohortIds.length > 0) {
        await tx.assignmentCohortAccess.createMany({
          data: uniqueCohortIds.map((cohortId) => ({ assignmentId: itemId, cohortId })),
        });
      }
    } else if (itemType === AccessItemType.CONTENT) {
      await tx.contentCohortAccess.deleteMany({ where: { contentId: itemId } });
      if (uniqueCohortIds.length > 0) {
        await tx.contentCohortAccess.createMany({
          data: uniqueCohortIds.map((cohortId) => ({ contentId: itemId, cohortId })),
        });
      }
    }
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  revalidatePath('/[locale]/student/course/[courseId]/modules', 'page');

  return { success: true };
}

/**
 * Add an individual student override for an item.
 */
export async function addStudentOverride(
  itemType: AccessItemType,
  itemId: string,
  userId: string
) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const override = await db.itemAccessOverride.upsert({
    where: {
      itemType_itemId_userId: {
        itemType,
        itemId,
        userId,
      },
    },
    update: {},
    create: {
      itemType,
      itemId,
      userId,
    },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  revalidatePath('/[locale]/student/course/[courseId]/modules', 'page');

  return { success: true, override };
}

/**
 * Remove an individual student override for an item.
 */
export async function removeStudentOverride(
  itemType: AccessItemType,
  itemId: string,
  userId: string
) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  await db.itemAccessOverride.deleteMany({
    where: {
      itemType,
      itemId,
      userId,
    },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  revalidatePath('/[locale]/student/course/[courseId]/modules', 'page');

  return { success: true };
}

/**
 * Retrieve cohorts and students enrolled in or relevant to a course.
 */
export async function getCourseCohortsAndStudents(courseId: string) {
  await requireAuth();

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      schoolId: true,
      enrollments: {
        include: {
          user: {
            select: { id: true, name: true, email: true, nis: true },
          },
          cohort: {
            select: { id: true, name: true },
          },
        },
        orderBy: { user: { name: 'asc' } },
      },
    },
  });

  if (!course) {
    throw new Error('Course not found');
  }

  // Fetch all active cohorts in the school
  const schoolCohorts = await db.cohort.findMany({
    where: { schoolId: course.schoolId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  // Extract enrolled cohorts from enrollments
  const enrolledCohortMap = new Map<string, string>();
  for (const e of course.enrollments) {
    if (e.cohort) {
      enrolledCohortMap.set(e.cohort.id, e.cohort.name);
    }
  }

  // Combine cohorts: school cohorts + enrolled cohorts
  const cohortMap = new Map<string, string>();
  for (const sc of schoolCohorts) {
    cohortMap.set(sc.id, sc.name);
  }
  for (const [id, name] of enrolledCohortMap.entries()) {
    cohortMap.set(id, name);
  }

  const cohorts = Array.from(cohortMap.entries()).map(([id, name]) => ({ id, name }));

  const enrolledStudents = course.enrollments.map((e) => ({
    id: e.user.id,
    name: e.user.name,
    email: e.user.email,
    nis: e.user.nis,
    cohortId: e.cohort?.id || null,
    cohortName: e.cohort?.name || null,
  }));

  return {
    cohorts,
    enrolledStudents,
  };
}
