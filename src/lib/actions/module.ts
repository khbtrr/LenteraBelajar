'use server';

import { db } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/auth-utils';
import { ContentType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { assertCourseAccess, assertModuleAccess, assertItemAccess } from '@/lib/access';
import { assertFileReferences, bindFileReferences } from '@/lib/files';
import { sanitizeRichText } from '@/lib/rich-text';
import { normalizeInteractiveUrl } from '@/lib/interactive-utils';

export async function getCourseModules(courseId: string) {
  const { session } = await assertCourseAccess(courseId);

  const modules = await db.module.findMany({
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
        where: session.user.role === 'STUDENT' ? { isPublished: true } : undefined,
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
        where: session.user.role === 'STUDENT' ? { isPublished: true } : undefined,
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
  if (session.user.role !== 'STUDENT') return modules;
  return Promise.all(modules.map(async (module) => ({
    ...module,
    contents: await visibleItems('CONTENT', module.contents),
    quizzes: (await visibleItems('QUIZ', module.quizzes)).map((quiz) => ({ ...quiz, token: null })),
    assignments: await visibleItems('ASSIGNMENT', module.assignments),
  })));
}

async function visibleItems<T extends { id: string }>(type: 'QUIZ' | 'ASSIGNMENT' | 'CONTENT', items: T[]) {
  const allowed = await Promise.all(items.map(async (item) => {
    try { await assertItemAccess(type, item.id); return true; } catch { return false; }
  }));
  return items.filter((_, index) => allowed[index]);
}

export async function createModule(courseId: string, title: string) {
  await assertCourseAccess(courseId, 'manage');

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
  await assertModuleAccess(moduleId, 'manage');

  const updated = await db.module.update({
    where: { id: moduleId },
    data: { title },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  return updated;
}

export async function deleteModule(moduleId: string) {
  await assertModuleAccess(moduleId, 'manage');

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
  await assertModuleAccess(data.moduleId, 'manage');
  await assertFileReferences(data);
  if (data.fileUrl) normalizeInteractiveUrl(data.fileUrl);

  const count = await db.content.count({ where: { moduleId: data.moduleId } });

  const content = await db.content.create({
    data: {
      moduleId: data.moduleId,
      title: data.title,
      type: data.type,
      body: data.body ? sanitizeRichText(data.body) : null,
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      fileSize: data.fileSize || null,
      order: count,
    },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  revalidatePath('/[locale]/student/course/[courseId]/modules', 'page');
  await bindFileReferences('CONTENT', content.id, data);
  return content;
}

export async function deleteContent(contentId: string) {
  await assertItemAccess('CONTENT', contentId, 'manage');

  const deleted = await db.content.delete({
    where: { id: contentId },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  return deleted;
}
