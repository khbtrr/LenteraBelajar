'use server';

import { db } from '@/lib/db';
import { requireSchool, requireRole } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';

export async function getCategories() {
  const session = await requireSchool();
  return db.category.findMany({
    where: { schoolId: session.schoolId },
    include: {
      parent: true,
      children: {
        include: {
          children: true,
        },
      },
      _count: {
        select: { courses: true },
      },
    },
    orderBy: { order: 'asc' },
  });
}

export async function getCategoryTree() {
  const session = await requireSchool();
  // Fetch top-level categories (parentId: null)
  return db.category.findMany({
    where: { schoolId: session.schoolId, parentId: null },
    include: {
      children: {
        include: {
          children: true,
        },
      },
      _count: {
        select: { courses: true },
      },
    },
    orderBy: { order: 'asc' },
  });
}

export async function createCategory(data: {
  name: string;
  parentId?: string | null;
  order?: number;
}) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const category = await db.category.create({
    data: {
      name: data.name,
      slug: `${slug}-${Date.now().toString().slice(-4)}`,
      parentId: data.parentId || null,
      order: data.order || 0,
      schoolId,
    },
  });

  revalidatePath('/[locale]/admin/categories', 'page');
  return category;
}

export async function deleteCategory(id: string) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  const deleted = await db.category.delete({
    where: { id, schoolId },
  });

  revalidatePath('/[locale]/admin/categories', 'page');
  return deleted;
}
