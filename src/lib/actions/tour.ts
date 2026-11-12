'use server';

import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';

export async function completeUserTour() {
  const session = await requireAuth();
  await db.user.update({
    where: { id: session.user.id },
    data: { tourCompletedAt: new Date() },
  });

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function resetUserTour() {
  const session = await requireAuth();
  await db.user.update({
    where: { id: session.user.id },
    data: { tourCompletedAt: null },
  });

  revalidatePath('/', 'layout');
  return { success: true };
}
