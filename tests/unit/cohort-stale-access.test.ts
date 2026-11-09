import { describe, it, expect, vi, beforeEach } from 'vitest';

const schoolUser = vi.hoisted(() => ({ id: 'admin-1', role: 'ADMIN', schoolId: 'school-1' }));
const updatedEnrollmentWhere = vi.hoisted(() => [] as unknown[]);

vi.mock('@/lib/auth-utils', () => ({
  requireRole: async () => ({ user: schoolUser }),
  requireSchool: async () => ({ schoolId: schoolUser.schoolId, user: schoolUser }),
  requireAuth: async () => ({ user: { id: 'student-1', role: 'STUDENT', schoolId: 'school-1' } }),
  hashPassword: (p: string) => `hash:${p}`,
}));

vi.mock('@/lib/user-scope', () => ({
  isUserInSchool: () => true,
  getUserSchoolIds: () => ['school-1'],
}));

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}));

const mockCohort = vi.hoisted(() => ({
  id: 'cohort-1',
  name: 'Kelas 10A',
  schoolId: 'school-1',
}));

vi.mock('@/lib/db', () => ({
  db: {
    cohort: {
      findUnique: async () => mockCohort,
    },
    cohortMember: {
      count: async () => 1,
      delete: async () => ({ id: 'cm-1' }),
      deleteMany: async () => ({ count: 1 }),
      upsert: async () => ({ id: 'cm-target' }),
    },
    enrollment: {
      updateMany: vi.fn(async ({ where }: { where: unknown }) => {
        updatedEnrollmentWhere.push(where);
        return { count: 1 };
      }),
    },
    user: {
      findUnique: async () => ({ id: 'student-1', role: 'STUDENT', schoolId: 'school-1', isActive: true }),
      findMany: async () => [{ id: 'student-1', schoolId: 'school-1', nis: '12345' }],
      updateMany: async () => ({ count: 1 }),
    },
    $transaction: async (input: unknown) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }
      if (typeof input === 'function') {
        const tx = {
          cohortMember: {
            deleteMany: async () => ({ count: 1 }),
            upsert: async () => ({ id: 'cm-target' }),
          },
          enrollment: {
            updateMany: vi.fn(async ({ where }: { where: unknown }) => {
              updatedEnrollmentWhere.push(where);
              return { count: 1 };
            }),
          },
          user: {
            updateMany: async () => ({ count: 1 }),
          },
        };
        return input(tx);
      }
      return input;
    },
  },
}));

import {
  removeStudentFromCohort,
  bulkRemoveStudentsFromCohort,
  promoteCohortStudents,
  graduateCohortStudents,
} from '@/lib/actions/cohort';

describe('Cohort removal enrollment cleanup (Finding #2)', () => {
  beforeEach(() => {
    updatedEnrollmentWhere.length = 0;
  });

  it('clears Enrollment.cohortId on removeStudentFromCohort', async () => {
    await removeStudentFromCohort('cohort-1', 'student-1');

    expect(updatedEnrollmentWhere.length).toBe(1);
    expect(updatedEnrollmentWhere[0]).toEqual({
      cohortId: 'cohort-1',
      userId: 'student-1',
    });
  });

  it('clears Enrollment.cohortId on bulkRemoveStudentsFromCohort', async () => {
    await bulkRemoveStudentsFromCohort('cohort-1', ['student-1', 'student-2']);

    expect(updatedEnrollmentWhere.length).toBe(1);
    expect(updatedEnrollmentWhere[0]).toEqual({
      cohortId: 'cohort-1',
      userId: { in: ['student-1', 'student-2'] },
    });
  });

  it('clears Enrollment.cohortId on promoteCohortStudents when removeFromSourceCohort is true', async () => {
    await promoteCohortStudents({
      sourceCohortId: 'cohort-1',
      targetCohortId: 'cohort-2',
      studentIds: ['student-1'],
      removeFromSourceCohort: true,
    });

    expect(updatedEnrollmentWhere.length).toBe(1);
    expect(updatedEnrollmentWhere[0]).toEqual({
      cohortId: 'cohort-1',
      userId: { in: ['student-1'] },
    });
  });

  it('clears Enrollment.cohortId on graduateCohortStudents', async () => {
    await graduateCohortStudents({
      cohortId: 'cohort-1',
      studentIds: ['student-1'],
    });

    expect(updatedEnrollmentWhere.length).toBe(1);
    expect(updatedEnrollmentWhere[0]).toEqual({
      cohortId: 'cohort-1',
      userId: { in: ['student-1'] },
    });
  });
});
