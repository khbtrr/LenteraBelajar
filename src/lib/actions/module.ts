'use server';

import { db } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/auth-utils';
import { ContentType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getCourseModules(courseId: string) {
  await requireAuth();

  return db.module.findMany({
    where: { courseId },
    orderBy: { order: 'asc' },
    include: {
      contents: {
        orderBy: { order: 'asc' },
        include: {
          cohortAccess: {
            include: {
              cohort: { select: { id: true, name: true } },
            },
          },
        },
      },
      quizzes: {
        orderBy: { order: 'asc' },
        include: {
          cohortAccess: {
            include: {
              cohort: { select: { id: true, name: true } },
            },
          },
          _count: {
            select: {
              questions: true,
              attempts: true,
            },
          },
        },
      },
      assignments: {
        orderBy: { order: 'asc' },
        include: {
          cohortAccess: {
            include: {
              cohort: { select: { id: true, name: true } },
            },
          },
          _count: {
            select: {
              submissions: true,
            },
          },
        },
      },
    },
  });
}

export async function createModule(courseId: string, title: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const count = await db.module.count({ where: { courseId } });

  const moduleItem = await db.module.create({
    data: {
      courseId,
      title,
      order: count,
    },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  revalidatePath('/[locale]/student/course/[courseId]/modules', 'page');
  return moduleItem;
}

export async function updateModule(moduleId: string, title: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const updated = await db.module.update({
    where: { id: moduleId },
    data: { title },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  return updated;
}

export async function deleteModule(moduleId: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const deleted = await db.module.delete({
    where: { id: moduleId },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  return deleted;
}

export async function createContent(data: {
  moduleId: string;
  title: string;
  type: ContentType;
  body?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const count = await db.content.count({ where: { moduleId: data.moduleId } });

  const content = await db.content.create({
    data: {
      moduleId: data.moduleId,
      title: data.title,
      type: data.type,
      body: data.body || null,
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      fileSize: data.fileSize || null,
      order: count,
    },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  revalidatePath('/[locale]/student/course/[courseId]/modules', 'page');
  return content;
}

export async function deleteContent(contentId: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const deleted = await db.content.delete({
    where: { id: contentId },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  return deleted;
}
