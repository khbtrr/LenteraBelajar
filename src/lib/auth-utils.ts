import 'server-only';
import { hashSync, compareSync } from 'bcryptjs';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { getIndukSchool } from '@/lib/school';

export function hashPassword(password: string): string {
  return hashSync(password, 12);
}

export function verifyPassword(password: string, hash: string): boolean {
  return compareSync(password, hash);
}

export async function getServerSession(options: { allowPasswordChange?: boolean } = {}) {
  const session = await auth();
  if (!session?.user) return null;
  const account = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, role: true, schoolId: true, isActive: true,
      mustChangePassword: true, sessionVersion: true, locale: true,
      assignedSchools: { select: { schoolId: true } },
    },
  });
  if (!account?.isActive || session.user.sessionVersion !== account.sessionVersion) return null;
  if (account.mustChangePassword && !options.allowPasswordChange) return null;
  let requestedSchool: string | undefined;
  try {
    requestedSchool = (await cookies()).get('active_school_id')?.value;
  } catch {}
  const assignedSchoolIds = account.assignedSchools.map((assignment) => assignment.schoolId);
  const allowed = [account.schoolId, ...assignedSchoolIds].filter((id): id is string => Boolean(id));
  let schoolId: string | null = account.schoolId ?? assignedSchoolIds[0] ?? null;
  if (requestedSchool && (account.role === 'SUPER_ADMIN' || allowed.includes(requestedSchool))) {
    schoolId = requestedSchool;
  }
  if (!schoolId && account.role === 'SUPER_ADMIN') {
    schoolId = (await getIndukSchool({ id: true }))?.id ?? null;
  }
  if (!schoolId && account.role !== 'SUPER_ADMIN') return null;
  if (schoolId && !await db.school.findUnique({ where: { id: schoolId, isActive: true }, select: { id: true } })) {
    return null;
  }
  return { ...session, user: {
    ...session.user, id: account.id, name: account.name, email: account.email,
    role: account.role, schoolId, homeSchoolId: account.schoolId, assignedSchoolIds,
    mustChangePassword: account.mustChangePassword, sessionVersion: account.sessionVersion, locale: account.locale,
  } };
}

export async function getActiveSchoolId(): Promise<string | null> {
  return (await getServerSession())?.user.schoolId ?? null;
}

export async function requireAuth(options: { allowPasswordChange?: boolean } = {}) {
  const session = await getServerSession({ allowPasswordChange: true });
  if (!session) redirect('/login');
  if (session.user.mustChangePassword && !options.allowPasswordChange) {
    redirect(`/${session.user.locale || 'id'}/change-password`);
  }
  return session;
}

export async function requireRole(...roles: Role[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    throw new Error('Akses ditolak: Peran tidak diizinkan');
  }
  return session;
}

export async function requireSchool() {
  const session = await requireAuth();
  if (!session.user.schoolId) {
    throw new Error('Sekolah tidak ditemukan');
  }
  return { ...session, schoolId: session.user.schoolId };
}
