'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { routing } from '@/i18n/routing';

/**
 * Update the user's preferred language in the database
 */
export async function updateUserLocale(newLocale: string): Promise<{ success: boolean }> {
  try {
    if (!routing.locales.includes(newLocale as any)) {
      return { success: false };
    }

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false };
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { locale: newLocale },
    });

    return { success: true };
  } catch (error) {
    console.error('[i18n] Failed to update user locale in database:', error);
    return { success: false };
  }
}
