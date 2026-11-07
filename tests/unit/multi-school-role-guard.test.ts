import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@prisma/client';

const actor = vi.hoisted(() => ({ role: 'ADMIN', schoolId: 'school-a' }));
const target = vi.hoisted(() => ({
  value: null as null | Record<string, unknown>,
}));
const update = vi.hoisted(() => vi.fn(async ({ data }: { data: unknown }) => data));
const courseCount = vi.hoisted(() => ({ value: 0 }));

vi.mock('@/lib/auth-utils', () => ({
  requireRole: async () => ({ user: { id: 'actor', email: 'actor@lentera.test', role: actor.role, schoolId: actor.schoolId } }),
  requireSchool: async () => ({ schoolId: actor.schoolId }),
  hashPassword: (value: string) => `hash:${value}`,
}));
vi.mock('@/lib/audit-log', () => ({ recordAuditLog: async () => {} }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: async ({ where }: { where: { email?: string } }) => (where.email ? null : target.value),
      update,
    },
    userSchool: { deleteMany: async () => ({}), upsert: async () => ({}) },
    course: { count: async () => courseCount.value },
  },
}));

import { resetUserPassword, updateUser } from '@/lib/actions/user';
import { isMultiSchoolUser, isUserInSchool, getUserSchoolIds } from '@/lib/user-scope';

function setTarget(assignedSchoolIds: string[], role: Role = Role.TEACHER) {
  target.value = {
    id: 'teacher-ab',
    name: 'Teacher AB',
    email: 'teacher-ab@lentera.test',
    role,
    schoolId: 'school-a',
    isActive: true,
    nis: null,
    nip: 'NIP1',
    assignedSchools: assignedSchoolIds.map((schoolId) => ({ schoolId })),
  };
}

const profile = { name: 'Teacher AB', email: 'teacher-ab@lentera.test' };

describe('isMultiSchoolUser', () => {
  it('counts the home school together with assignments', () => {
    expect(isMultiSchoolUser({ schoolId: 'a', assignedSchools: [] })).toBe(false);
    expect(isMultiSchoolUser({ schoolId: 'a', assignedSchools: [{ schoolId: 'a' }] })).toBe(false);
    expect(isMultiSchoolUser({ schoolId: 'a', assignedSchools: [{ schoolId: 'b' }] })).toBe(true);
    expect(isMultiSchoolUser({ schoolId: null, assignedSchools: [{ schoolId: 'a' }, { schoolId: 'b' }] })).toBe(true);
  });

  it('resolves all school IDs associated with a user', () => {
    expect(getUserSchoolIds({ schoolId: 'a', assignedSchoolIds: ['b', 'c'] })).toEqual(['a', 'b', 'c']);
    expect(isUserInSchool({ schoolId: 'a', assignedSchoolIds: ['b'] }, 'b')).toBe(true);
    expect(isUserInSchool({ schoolId: 'a', assignedSchoolIds: ['b'] }, 'c')).toBe(false);
  });
});

describe('multi-school users and school admins', () => {
  beforeEach(() => {
    actor.role = 'ADMIN';
    actor.schoolId = 'school-a';
    courseCount.value = 0;
    update.mockClear();
  });

  it('blocks a school admin from promoting a multi-school user', async () => {
    setTarget(['school-a', 'school-b']);
    await expect(updateUser('teacher-ab', { ...profile, role: Role.ADMIN })).rejects.toThrow(/lebih dari satu sekolah/);
    expect(update).not.toHaveBeenCalled();
  });

  it('blocks a school admin from resetting a multi-school password', async () => {
    setTarget(['school-a', 'school-b']);
    await expect(resetUserPassword('teacher-ab')).rejects.toThrow(/lebih dari satu sekolah/);
    expect(update).not.toHaveBeenCalled();
  });

  it('still lets a school admin edit a multi-school user without changing the role', async () => {
    setTarget(['school-a', 'school-b']);
    await expect(updateUser('teacher-ab', { ...profile, name: 'Renamed', role: Role.TEACHER })).resolves.toBeDefined();
  });

  it('keeps single-school promotion and reset working', async () => {
    setTarget(['school-a']);
    await expect(updateUser('teacher-ab', { ...profile, role: Role.ADMIN })).resolves.toBeDefined();
    await expect(resetUserPassword('teacher-ab')).resolves.toBeDefined();
  });

  it('lets a super admin promote and reset a multi-school user', async () => {
    actor.role = 'SUPER_ADMIN';
    setTarget(['school-a', 'school-b']);
    await expect(updateUser('teacher-ab', { ...profile, role: Role.ADMIN })).resolves.toBeDefined();
    await expect(resetUserPassword('teacher-ab')).resolves.toBeDefined();
  });

  it('returns a one-time random password when resetting an admin', async () => {
    setTarget(['school-a'], Role.ADMIN);
    const first = await resetUserPassword('teacher-ab');
    const second = await resetUserPassword('teacher-ab');
    expect(first.temporaryPassword).toBeTruthy();
    expect(first.temporaryPassword).not.toBe(second.temporaryPassword);
    expect(first.temporaryPassword).not.toBe('Lentera2026!');
  });

  it('returns no temporary password for a teacher with a NIP', async () => {
    setTarget(['school-a'], Role.TEACHER);
    const result = await resetUserPassword('teacher-ab');
    expect(result.temporaryPassword).toBeUndefined();
  });

  it('blocks removing an assigned school when the teacher owns active courses there', async () => {
    actor.role = 'SUPER_ADMIN';
    setTarget(['school-a', 'school-b'], Role.TEACHER);
    courseCount.value = 2;
    await expect(
      updateUser('teacher-ab', { ...profile, role: Role.TEACHER, assignedSchoolIds: ['school-a'] })
    ).rejects.toThrow(/guru pengampu di 2 kelas pada sekolah yang akan dicabut/);
    expect(update).not.toHaveBeenCalled();
  });

  it('blocks changing a teacher role when the user owns active courses', async () => {
    actor.role = 'SUPER_ADMIN';
    setTarget(['school-a'], Role.TEACHER);
    courseCount.value = 3;
    await expect(
      updateUser('teacher-ab', { ...profile, role: Role.STUDENT })
    ).rejects.toThrow(/guru pengampu di 3 kelas/);
    expect(update).not.toHaveBeenCalled();
  });
});
