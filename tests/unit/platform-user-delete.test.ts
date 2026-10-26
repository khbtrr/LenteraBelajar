import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@prisma/client';

const actor = vi.hoisted(() => ({
  id: 'super-admin-1',
  role: 'SUPER_ADMIN',
  schoolId: null,
}));

vi.mock('@/lib/auth', () => ({
  auth: async () => ({
    user: {
      id: actor.id,
      role: actor.role,
      schoolId: actor.schoolId,
      sessionVersion: 0,
      email: 'superadmin@lentera.test',
    },
  }),
}));

vi.mock('@/lib/school', () => ({
  getIndukSchool: async () => ({ id: 'school-induk' }),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

const revalidatedPaths: string[] = [];
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => {
    revalidatedPaths.push(path);
  },
}));

const auditLogsRecorded: any[] = [];
vi.mock('@/lib/audit-log', () => ({
  recordAuditLog: async (entry: any) => {
    auditLogsRecorded.push(entry);
  },
}));

const deletedRecords: {
  directMessages: string[];
  quizAnswers: string[];
  quizAttempts: string[];
  assignmentSubmissions: string[];
  grades: string[];
  courseRequests: string[];
  userSchools: string[];
  users: string[];
  courses: string[];
} = {
  directMessages: [],
  quizAnswers: [],
  quizAttempts: [],
  assignmentSubmissions: [],
  grades: [],
  courseRequests: [],
  userSchools: [],
  users: [],
  courses: [],
};

let mockTeachingCoursesCount = 0;
let mockTargetUser: any = {
  id: 'target-user-1',
  name: 'Budi Guru',
  email: 'budi@sekolah.sch.id',
  role: Role.TEACHER,
};

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: async ({ where }: any) => {
        if (where.id === 'super-admin-1') {
          return {
            id: 'super-admin-1',
            name: 'Super Admin',
            email: 'superadmin@lentera.test',
            role: actor.role,
            schoolId: 'school-induk',
            isActive: true,
            mustChangePassword: false,
            sessionVersion: 0,
            locale: 'id',
            assignedSchools: [],
          };
        }
        if (where.id === mockTargetUser?.id) return mockTargetUser;
        if (where.id === 'non-existent') return null;
        return null;
      },
      count: async () => 1,
    },
    school: {
      findUnique: async () => ({ id: 'school-induk', isActive: true }),
    },
    course: {
      findMany: async ({ where }: any) => {
        if (where.teacherId === mockTargetUser?.id && mockTeachingCoursesCount > 0) {
          return Array.from({ length: mockTeachingCoursesCount }, (_, i) => ({
            id: `course-${i + 1}`,
            title: `Kelas Uji ${i + 1}`,
          }));
        }
        return [];
      },
    },
    $transaction: async (cb: any) => {
      const tx = {
        directMessage: {
          deleteMany: async ({ where }: any) => {
            deletedRecords.directMessages.push(where.senderId);
          },
        },
        quizAnswer: {
          deleteMany: async ({ where }: any) => {
            deletedRecords.quizAnswers.push(where.attempt?.userId);
          },
        },
        quizAttempt: {
          deleteMany: async ({ where }: any) => {
            deletedRecords.quizAttempts.push(where.userId);
          },
        },
        assignmentSubmission: {
          deleteMany: async ({ where }: any) => {
            deletedRecords.assignmentSubmissions.push(where.userId);
          },
        },
        grade: {
          deleteMany: async ({ where }: any) => {
            deletedRecords.grades.push(where.userId);
          },
        },
        courseRequest: {
          updateMany: async () => {},
          deleteMany: async ({ where }: any) => {
            deletedRecords.courseRequests.push(where.requesterId);
          },
        },
        userSchool: {
          deleteMany: async ({ where }: any) => {
            deletedRecords.userSchools.push(where.userId);
          },
        },
        course: {
          delete: async ({ where }: any) => {
            deletedRecords.courses.push(where.id);
          },
        },
        user: {
          delete: async ({ where }: any) => {
            deletedRecords.users.push(where.id);
          },
        },
      };
      return cb(tx);
    },
  },
}));

import { deletePlatformUser } from '@/lib/actions/platform';

describe('Super Admin: Permanent Delete User Action (deletePlatformUser)', () => {
  beforeEach(() => {
    actor.id = 'super-admin-1';
    actor.role = 'SUPER_ADMIN';
    mockTeachingCoursesCount = 0;
    mockTargetUser = {
      id: 'target-user-1',
      name: 'Budi Guru',
      email: 'budi@sekolah.sch.id',
      role: Role.TEACHER,
    };
    deletedRecords.directMessages = [];
    deletedRecords.quizAnswers = [];
    deletedRecords.quizAttempts = [];
    deletedRecords.assignmentSubmissions = [];
    deletedRecords.grades = [];
    deletedRecords.courseRequests = [];
    deletedRecords.userSchools = [];
    deletedRecords.users = [];
    deletedRecords.courses = [];
    revalidatedPaths.length = 0;
    auditLogsRecorded.length = 0;
  });

  it('prevents Super Admin from deleting their own account', async () => {
    const res = await deletePlatformUser('super-admin-1');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Anda tidak dapat menghapus akun Anda sendiri.');
  });

  it('returns error if target user does not exist', async () => {
    const res = await deletePlatformUser('non-existent');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Pengguna tidak ditemukan.');
  });

  it('prompts requiresForce if user is still assigned as teacher of courses and force is false', async () => {
    mockTeachingCoursesCount = 2;
    const res = await deletePlatformUser('target-user-1', false);
    expect(res.success).toBe(false);
    expect(res.requiresForce).toBe(true);
    expect(res.teachingCoursesCount).toBe(2);
    expect(res.error).toMatch(/masih tercatat sebagai guru pengampu di 2 kelas/);
  });

  it('successfully deletes teacher and courses when force is true', async () => {
    mockTeachingCoursesCount = 2;
    const res = await deletePlatformUser('target-user-1', true);
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/Budi Guru berhasil dihapus permanen.*beserta 2 kelas yang diampunya/);

    expect(deletedRecords.courses).toEqual(['course-1', 'course-2']);
    expect(deletedRecords.users).toContain('target-user-1');
    expect(revalidatedPaths).toContain('/[locale]/admin/courses');
  });

  it('successfully deletes user without classes normally without requiring force', async () => {
    mockTeachingCoursesCount = 0;
    const result = await deletePlatformUser('target-user-1', false);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Budi Guru berhasil dihapus permanen');

    // Verify cascaded relations deleted
    expect(deletedRecords.directMessages).toContain('target-user-1');
    expect(deletedRecords.quizAnswers).toContain('target-user-1');
    expect(deletedRecords.quizAttempts).toContain('target-user-1');
    expect(deletedRecords.assignmentSubmissions).toContain('target-user-1');
    expect(deletedRecords.grades).toContain('target-user-1');
    expect(deletedRecords.courseRequests).toContain('target-user-1');
    expect(deletedRecords.userSchools).toContain('target-user-1');
    expect(deletedRecords.users).toContain('target-user-1');

    // Verify audit log
    expect(auditLogsRecorded).toHaveLength(1);
    expect(auditLogsRecorded[0].action).toBe('USER_DELETED');

    // Verify paths revalidated
    expect(revalidatedPaths).toContain('/[locale]/platform/users');
    expect(revalidatedPaths).toContain('/[locale]/admin/users');
  });

  it('blocks non-super admin callers', async () => {
    actor.role = 'ADMIN';
    const res = await deletePlatformUser('target-user-1');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Akses Ditolak/i);
  });
});
