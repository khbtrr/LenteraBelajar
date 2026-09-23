import { hashSync, compareSync } from 'bcryptjs';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';

export function hashPassword(password: string): string {
  return hashSync(password, 12);
}

export function verifyPassword(password: string, hash: string): boolean {
  return compareSync(password, hash);
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  return session;
}

export async function requireRole(...roles: Role[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    redirect('/');
  }
  return session;
}

import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function getActiveSchoolId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return null;

  let cookieSchoolId: string | null = null;
  try {
    const cookieStore = await cookies();
    cookieSchoolId = cookieStore.get('active_school_id')?.value || null;
  } catch {
    // cookies() unavailable in non-request contexts
  }

  if (cookieSchoolId) {
    if (session.user.role === 'SUPER_ADMIN') {
      return cookieSchoolId;
    }
    if (cookieSchoolId === session.user.schoolId) {
      return cookieSchoolId;
    }
    const hasAssignment = await db.userSchool.findUnique({
      where: {
        userId_schoolId: {
          userId: session.user.id,
          schoolId: cookieSchoolId,
        },
      },
    });
    if (hasAssignment) {
      return cookieSchoolId;
    }
  }

  if (session.user.schoolId) {
    return session.user.schoolId;
  }

  if (session.user.role === 'SUPER_ADMIN') {
    const firstSchool = await db.school.findFirst({ select: { id: true } });
    return firstSchool?.id || null;
  }

  const firstAssignment = await db.userSchool.findFirst({
    where: { userId: session.user.id },
    select: { schoolId: true },
  });
  return firstAssignment?.schoolId || null;
}

export async function requireSchool() {
  const session = await requireAuth();
  const schoolId = await getActiveSchoolId();
  if (!schoolId) {
    redirect('/');
  }
  return { ...session, schoolId };
}
