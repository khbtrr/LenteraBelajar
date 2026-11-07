import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  role: 'STUDENT',
  schoolId: 'school-a',
  enrolled: false,
  course: {
    id: 'course-b', schoolId: 'school-b', teacherId: 'teacher-b', isCrossSchool: false,
    modules: [{ id: 'module-b', contents: [], assignments: [], quizzes: [{ id: 'quiz-b', token: 'SECRET', isPublished: true }] }],
    enrollments: [{ userId: 'other-student', user: { email: 'private@example.test' } }],
  },
}));

vi.mock('@/lib/auth', () => ({ auth: async () => ({ user: {
  id: 'caller', role: state.role, schoolId: state.schoolId, sessionVersion: 0,
} }) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('@/lib/db', () => ({ db: {
  user: { findUnique: async () => ({ id: 'caller', role: state.role, schoolId: state.schoolId,
    isActive: true, mustChangePassword: false, sessionVersion: 0, assignedSchools: [] }) },
  school: { findUnique: async () => ({ id: state.schoolId, isActive: true }) },
  userSchool: { findFirst: async () => null, findUnique: async () => null },
  course: { findUnique: async () => structuredClone(state.course) },
  module: { findMany: async () => structuredClone(state.course.modules), findUnique: async () => ({ courseId: state.course.id }) },
  quiz: { findUnique: async () => ({ moduleId: 'module-b', isPublished: true, isRemedial: false }) },
  quizCohortAccess: { findMany: async () => [] },
  enrollment: { findUnique: async () => state.enrolled ? { userId: 'caller', cohortId: null } : null },
} }));

import { getCourseById } from '@/lib/actions/course';

describe('course detail production action', () => {
  beforeEach(() => {
    state.role = 'STUDENT'; state.schoolId = 'school-a'; state.enrolled = false;
    state.course.isCrossSchool = false;
  });

  it('denies a student outside the private course', async () => {
    await expect(getCourseById('course-b')).rejects.toThrow(/Akses ditolak/);
  });
  it('allows an enrolled cross-school student without exposing a token or other participants', async () => {
    state.enrolled = true; state.course.isCrossSchool = true;
    const result = await getCourseById('course-b');
    expect(result?.modules[0].quizzes[0].token).toBeNull();
    expect(result?.enrollments).toEqual([]);
  });
  it('denies an administrator of another school', async () => {
    state.role = 'ADMIN';
    await expect(getCourseById('course-b')).rejects.toThrow(/Akses ditolak/);
  });
  it('allows the school supervisor to read the course', async () => {
    state.role = 'SUPERVISOR'; state.schoolId = 'school-b';
    expect((await getCourseById('course-b'))?.id).toBe('course-b');
  });

  it('denies a teacher who owns the course in a school they are not assigned to', async () => {
    state.role = 'TEACHER';
    state.course.teacherId = 'caller';
    state.schoolId = 'school-a';
    await expect(getCourseById('course-b')).rejects.toThrow(/Akses ditolak/);
  });

  it('allows a teacher who owns the course and is assigned to the course school', async () => {
    state.role = 'TEACHER';
    state.course.teacherId = 'caller';
    state.schoolId = 'school-b';
    expect((await getCourseById('course-b'))?.id).toBe('course-b');
  });
});
