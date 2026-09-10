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

export async function requireSchool() {
  const session = await requireAuth();
  if (!session.user.schoolId) {
    redirect('/');
  }
  return { ...session, schoolId: session.user.schoolId };
}
