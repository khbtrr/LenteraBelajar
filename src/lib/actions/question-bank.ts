'use server';

import { db } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/auth-utils';
import { QuestionType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getQuestionBankByCategory(courseId: string) {
  await requireAuth();

  const categories = await db.questionBankCategory.findMany({
    where: { courseId },
    include: {
      questions: {
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: { questions: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const uncategorized = await db.questionBank.findMany({
    where: { courseId, categoryId: null },
    orderBy: { createdAt: 'desc' },
  });

  return {
    categories,
    uncategorized,
    uncategorizedCount: uncategorized.length,
  };
}

export async function createQuestionBankCategory(courseId: string, name: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  if (!name.trim()) {
    throw new Error('Nama kategori tidak boleh kosong');
  }

  const category = await db.questionBankCategory.create({
    data: {
      name,
      courseId,
    },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]', 'layout');
  return category;
}

export async function updateQuestionBankCategory(categoryId: string, name: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  if (!name.trim()) {
    throw new Error('Nama kategori tidak boleh kosong');
  }

  const category = await db.questionBankCategory.update({
    where: { id: categoryId },
    data: { name },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]', 'layout');
  return category;
}

export async function deleteQuestionBankCategory(categoryId: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  // Pertanyaan di dalam kategori ini akan menjadi "uncategorized" (categoryId menjadi null)
  // berdasarkan aturan Prisma schema: onDelete: SetNull
  const deleted = await db.questionBankCategory.delete({
    where: { id: categoryId },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]', 'layout');
  return deleted;
}

export async function addQuestionToBank(data: {
  courseId: string;
  categoryId?: string | null;
  type: QuestionType;
  text: string;
  options?: { id: string; text: string; isCorrect: boolean }[];
  points?: number;
}) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  if (!data.text.trim()) {
    throw new Error('Teks pertanyaan tidak boleh kosong');
  }

  const question = await db.questionBank.create({
    data: {
      courseId: data.courseId,
      categoryId: data.categoryId || null,
      type: data.type,
      text: data.text,
      options: data.options ? (data.options as any) : undefined,
      points: data.points ? Number(data.points) : 1,
    },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]', 'layout');
  return question;
}

export async function updateBankQuestion(
  questionId: string,
  data: {
    text?: string;
    type?: QuestionType;
    options?: any;
    points?: number;
    categoryId?: string | null;
  }
) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  if (data.text !== undefined && !data.text.trim()) {
    throw new Error('Teks pertanyaan tidak boleh kosong');
  }

  const question = await db.questionBank.update({
    where: { id: questionId },
    data: {
      ...(data.text && { text: data.text }),
      ...(data.type && { type: data.type }),
      ...(data.options !== undefined && { options: data.options }),
      ...(data.points !== undefined && { points: Number(data.points) }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
    },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]', 'layout');
  return question;
}

export async function deleteBankQuestion(questionId: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const deleted = await db.questionBank.delete({
    where: { id: questionId },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]', 'layout');
  return deleted;
}

export async function bulkAddQuestionsToBank(
  courseId: string,
  categoryId: string | null,
  questions: {
    type: QuestionType;
    text: string;
    options?: { id: string; text: string; isCorrect: boolean }[];
    points?: number;
  }[]
) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  if (!questions || questions.length === 0) {
    throw new Error('Tidak ada pertanyaan untuk ditambahkan');
  }

  const created = await db.questionBank.createMany({
    data: questions.map((q) => ({
      courseId,
      categoryId,
      type: q.type,
      text: q.text,
      options: q.options ? (q.options as any) : undefined,
      points: q.points || 1,
    })),
  });

  revalidatePath('/[locale]/teacher/course/[courseId]', 'layout');
  return created;
}

export async function getQuestionBankStats(courseId: string) {
  await requireAuth();

  const [totalCount, typeGroups, categoryGroups] = await Promise.all([
    db.questionBank.count({ where: { courseId } }),
    db.questionBank.groupBy({
      by: ['type'],
      where: { courseId },
      _count: { _all: true },
    }),
    db.questionBank.groupBy({
      by: ['categoryId'],
      where: { courseId },
      _count: { _all: true },
    }),
  ]);

  const categories = await db.questionBankCategory.findMany({
    where: { courseId },
    select: { id: true, name: true },
  });

  const categoryMap = categories.reduce((acc, cat) => {
    acc[cat.id] = cat.name;
    return acc;
  }, {} as Record<string, string>);

  const types = typeGroups.map((g) => ({
    type: g.type,
    count: g._count._all,
  }));

  const byCategory = categoryGroups.map((g) => ({
    categoryId: g.categoryId,
    categoryName: g.categoryId
      ? categoryMap[g.categoryId] || 'Tidak Diketahui'
      : 'Belum Berkategori',
    count: g._count._all,
  }));

  return {
    totalQuestions: totalCount,
    types,
    byCategory,
  };
}
