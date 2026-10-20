import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role, ContentType } from '@prisma/client';

const actor = vi.hoisted(() => ({
  id: 'teacher-a',
  role: 'TEACHER',
  schoolId: 'school-a',
}));

vi.mock('@/lib/auth', () => ({
  auth: async () => ({
    user: {
      id: actor.id,
      role: actor.role,
      schoolId: actor.schoolId,
      sessionVersion: 0,
    },
  }),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}));

vi.mock('@/lib/files', () => ({
  assertFileReferences: async () => {},
  bindFileReferences: async () => {},
}));

vi.mock('@/lib/interactive-utils', () => ({
  normalizeInteractiveUrl: (url: string) => url,
}));

vi.mock('@/lib/rich-text', () => ({
  sanitizeRichText: (html: string) => html,
}));

vi.mock('@/lib/notifications', () => ({
  createBulkNotifications: async () => {},
}));

vi.mock('@/lib/quiz-analysis', () => ({
  loadQuizAnalysis: async () => ({
    quiz: { id: 'quiz-a', module: { courseId: 'course-a' }, passingGrade: 75 },
    attempts: [],
    snapshots: new Map(),
    questions: new Map(),
  }),
  analyzeQuestion: () => ({}),
}));

vi.mock('@/lib/course-grades', () => ({
  loadCourseGrades: async () => ({ scores: new Map() }),
}));

// Mock Database Tables
const users: Record<string, { id: string; role: Role; schoolId: string | null; isActive: boolean; name: string; email: string }> = {
  'super-admin': { id: 'super-admin', role: Role.SUPER_ADMIN, schoolId: 'school-a', isActive: true, name: 'Super Admin', email: 'super@lentera.test' },
  'admin-a': { id: 'admin-a', role: Role.ADMIN, schoolId: 'school-a', isActive: true, name: 'Admin A', email: 'admin-a@lentera.test' },
  'admin-b': { id: 'admin-b', role: Role.ADMIN, schoolId: 'school-b', isActive: true, name: 'Admin B', email: 'admin-b@lentera.test' },
  'teacher-a': { id: 'teacher-a', role: Role.TEACHER, schoolId: 'school-a', isActive: true, name: 'Teacher A', email: 'teacher-a@lentera.test' },
  'teacher-b': { id: 'teacher-b', role: Role.TEACHER, schoolId: 'school-b', isActive: true, name: 'Teacher B', email: 'teacher-b@lentera.test' },
  'student-a': { id: 'student-a', role: Role.STUDENT, schoolId: 'school-a', isActive: true, name: 'Student A', email: 'student-a@lentera.test' },
  'student-b': { id: 'student-b', role: Role.STUDENT, schoolId: 'school-b', isActive: true, name: 'Student B', email: 'student-b@lentera.test' },
};

const courses: Record<string, { id: string; schoolId: string; teacherId: string; isCrossSchool: boolean; title: string; school: any }> = {
  'course-a': {
    id: 'course-a',
    schoolId: 'school-a',
    teacherId: 'teacher-a',
    isCrossSchool: false,
    title: 'Course A',
    school: { defaultPassingGrade: 75, requireExamToken: false, enableLockdown: false, maxTabSwitches: 3 },
  },
  'course-b': {
    id: 'course-b',
    schoolId: 'school-b',
    teacherId: 'teacher-b',
    isCrossSchool: false,
    title: 'Course B',
    school: { defaultPassingGrade: 75, requireExamToken: false, enableLockdown: false, maxTabSwitches: 3 },
  },
};

const modules: Record<string, { id: string; courseId: string; title: string }> = {
  'module-a': { id: 'module-a', courseId: 'course-a', title: 'Module A' },
  'module-b': { id: 'module-b', courseId: 'course-b', title: 'Module B' },
};

const assignments: Record<string, { id: string; moduleId: string; title: string; isPublished: boolean }> = {
  'assignment-a': { id: 'assignment-a', moduleId: 'module-a', title: 'Assignment A', isPublished: true },
  'assignment-b': { id: 'assignment-b', moduleId: 'module-b', title: 'Assignment B', isPublished: true },
};

const contents: Record<string, { id: string; moduleId: string; title: string; type: ContentType }> = {
  'content-a': { id: 'content-a', moduleId: 'module-a', title: 'Content A', type: ContentType.TEXT },
  'content-b': { id: 'content-b', moduleId: 'module-b', title: 'Content B', type: ContentType.TEXT },
};

const quizzes: Record<string, { id: string; moduleId: string; title: string; isPublished: boolean; isRemedial: boolean; targetStudentIds: string[] }> = {
  'quiz-a': { id: 'quiz-a', moduleId: 'module-a', title: 'Quiz A', isPublished: true, isRemedial: false, targetStudentIds: [] },
  'quiz-b': { id: 'quiz-b', moduleId: 'module-b', title: 'Quiz B', isPublished: true, isRemedial: false, targetStudentIds: [] },
};

const cohorts: Record<string, { id: string; schoolId: string; name: string; isActive: boolean }> = {
  'cohort-a': { id: 'cohort-a', schoolId: 'school-a', name: 'Kelas 10A', isActive: true },
  'cohort-b': { id: 'cohort-b', schoolId: 'school-b', name: 'Kelas 10B', isActive: true },
};

const bankCategories: Record<string, { id: string; courseId: string; name: string }> = {
  'cat-a': { id: 'cat-a', courseId: 'course-a', name: 'Bab 1 Course A' },
  'cat-b': { id: 'cat-b', courseId: 'course-b', name: 'Bab 1 Course B' },
};

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) {
          const u = users[where.id];
          return u ? { ...u, mustChangePassword: false, sessionVersion: 0, assignedSchools: [] } : null;
        }
        if (where.email) {
          const found = Object.values(users).find((u) => u.email.toLowerCase() === where.email?.toLowerCase());
          return found ? { ...found, mustChangePassword: false, sessionVersion: 0, assignedSchools: [] } : null;
        }
        return null;
      },
      create: async ({ data }: { data: any }) => ({ id: `new-user-${Date.now()}`, ...data }),
      update: async ({ where, data }: { where: any; data: any }) => ({ id: where.id, ...data }),
      updateMany: async () => ({ count: 1 }),
    },
    school: {
      findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id, isActive: true }),
    },
    course: {
      findUnique: async ({ where }: { where: { id: string } }) => courses[where.id] ?? null,
    },
    module: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const m = modules[where.id];
        return m ? { ...m, course: { ...courses[m.courseId], enrollments: [] } } : null;
      },
      count: async () => 1,
      create: async ({ data }: { data: any }) => ({ id: `new-mod-${Date.now()}`, ...data }),
      update: async ({ where, data }: { where: { id: string }; data: any }) => ({ ...modules[where.id], ...data }),
      delete: async ({ where }: { where: { id: string } }) => modules[where.id],
    },
    assignment: {
      findUnique: async ({ where }: { where: { id: string } }) => assignments[where.id] ?? null,
      update: async ({ where, data }: { where: { id: string }; data: any }) => ({ ...assignments[where.id], ...data }),
      delete: async ({ where }: { where: { id: string } }) => assignments[where.id],
    },
    content: {
      findUnique: async ({ where }: { where: { id: string } }) => contents[where.id] ?? null,
      count: async () => 1,
      create: async ({ data }: { data: any }) => ({ id: `new-content-${Date.now()}`, ...data }),
      delete: async ({ where }: { where: { id: string } }) => contents[where.id],
    },
    quiz: {
      findUnique: async ({ where }: { where: { id: string } }) => quizzes[where.id] ?? null,
      count: async () => 1,
      create: async ({ data }: { data: any }) => ({ id: `new-quiz-${Date.now()}`, ...data }),
    },
    cohort: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const c = cohorts[where.id];
        return c ? { ...c, members: [{ userId: 'student-b' }] } : null;
      },
      findMany: async ({ where }: { where: { schoolId?: string } }) =>
        Object.values(cohorts).filter((c) => !where?.schoolId || c.schoolId === where.schoolId),
      findFirst: async () => null,
      count: async () => 1,
      create: async ({ data }: { data: any }) => ({ id: `new-cohort-${Date.now()}`, ...data }),
    },
    cohortMember: {
      upsert: async ({ create }: { create: any }) => create,
      count: async () => 1,
      delete: async () => ({ id: 'del-id' }),
      deleteMany: async () => ({ count: 1 }),
      findFirst: async () => null,
    },
    enrollment: {
      findUnique: async () => ({ id: 'enrollment-1', cohortId: null }),
      upsert: async ({ create }: { create: any }) => create,
    },
    quizCohortAccess: { findMany: async () => [] },
    assignmentCohortAccess: { findMany: async () => [] },
    contentCohortAccess: { findMany: async () => [] },
    itemAccessOverride: { findUnique: async () => null },
    questionBankCategory: {
      findUnique: async ({ where }: { where: { id: string } }) => bankCategories[where.id] ?? null,
      findFirst: async ({ where }: { where: { id: string; courseId: string } }) => {
        const cat = bankCategories[where.id];
        return cat && cat.courseId === where.courseId ? cat : null;
      },
      create: async ({ data }: { data: any }) => ({ id: `new-cat-${Date.now()}`, ...data }),
      update: async ({ where, data }: { where: { id: string }; data: any }) => ({ ...bankCategories[where.id], ...data }),
      delete: async ({ where }: { where: { id: string } }) => bankCategories[where.id],
    },
    questionBank: {
      findUnique: async () => null,
      findMany: async () => [],
    },
    $transaction: async (cb: any) => cb({
      cohortMember: { deleteMany: async () => ({ count: 1 }) },
      user: { updateMany: async () => ({ count: 1 }) },
    }),
  },
}));

// Import Production Actions
import { addStudentToCohort, promoteCohortStudents, graduateCohortStudents, syncCohortToCourse } from '@/lib/actions/cohort';
import { bulkImportUsers } from '@/lib/actions/user';
import { updateModule, deleteModule, createContent, deleteContent } from '@/lib/actions/module';
import { updateAssignment, deleteAssignment } from '@/lib/actions/assignment';
import { createQuestionBankCategory, deleteQuestionBankCategory } from '@/lib/actions/question-bank';
import { getItemAnalysisData } from '@/lib/actions/item-analysis';
import { getRemedialEligibleData } from '@/lib/actions/remedial';
import { createQuiz } from '@/lib/actions/quiz';

describe('P1 Security Remediation Action Verification (QA-05, QA-06, QA-15, QA-17, QA-18)', () => {

  describe('QA-05: Cohort & Enrollment Multi-Tenant Boundary Isolation', () => {
    beforeEach(() => {
      actor.id = 'admin-a';
      actor.role = Role.ADMIN;
      actor.schoolId = 'school-a';
    });

    it('blocks adding a student from School B into a School A cohort', async () => {
      // Admin A tries to add Student B (from School B) to Cohort A
      await expect(addStudentToCohort('cohort-a', 'student-b')).rejects.toThrow(
        /Akses ditolak: Siswa tidak berada dalam sekolah tujuan/
      );
    });

    it('blocks promoting cohort students across different schools', async () => {
      // Source cohort is School A, target cohort is School B
      await expect(
        promoteCohortStudents({
          sourceCohortId: 'cohort-a',
          targetCohortId: 'cohort-b',
          studentIds: ['student-a'],
          removeFromSourceCohort: true,
        })
      ).rejects.toThrow(/Akses ditolak/);
    });

    it('blocks promoting students belonging to another school', async () => {
      // Trying to promote student-b inside school-a's cohort
      await expect(
        promoteCohortStudents({
          sourceCohortId: 'cohort-a',
          targetCohortId: 'cohort-a',
          studentIds: ['student-b'],
          removeFromSourceCohort: true,
        })
      ).rejects.toThrow(/Akses ditolak: Siswa tidak berada dalam sekolah tujuan/);
    });

    it('blocks graduating cohort in a foreign school', async () => {
      // Admin A tries to graduate students in Cohort B (School B)
      await expect(
        graduateCohortStudents({
          cohortId: 'cohort-b',
          studentIds: ['student-b'],
        })
      ).rejects.toThrow(/Akses ditolak: Data tidak berada dalam sekolah Anda/);
    });

    it('blocks syncing foreign cohort to a non-cross-school course', async () => {
      actor.id = 'teacher-a';
      actor.role = Role.TEACHER;
      actor.schoolId = 'school-a';

      // Teacher A manages Course A (School A). Attempting to sync Cohort B (School B)
      await expect(syncCohortToCourse('course-a', 'cohort-b')).rejects.toThrow(
        /Akses ditolak: Sekolah rombel berbeda/
      );
    });
  });

  describe('QA-06: Bulk User Import Isolation and Privilege Protection', () => {
    beforeEach(() => {
      actor.id = 'admin-a';
      actor.role = Role.ADMIN;
      actor.schoolId = 'school-a';
    });

    it('blocks importing or updating an email belonging to another school', async () => {
      // Email belongs to student-b (school-b)
      await expect(
        bulkImportUsers([
          {
            name: 'Malicious Overwrite',
            email: 'student-b@lentera.test',
            role: Role.STUDENT,
          },
        ])
      ).rejects.toThrow(/Gagal mengimpor: Email student-b@lentera.test sudah terdaftar/);
    });

    it('blocks local school admin from creating or importing a SUPER_ADMIN account', async () => {
      await expect(
        bulkImportUsers([
          {
            name: 'Fake Super Admin',
            email: 'fake-super@lentera.test',
            role: Role.SUPER_ADMIN,
          },
        ])
      ).rejects.toThrow(/Akses ditolak: Peran Super Admin tidak dapat diimpor/);
    });

    it('blocks overwriting an existing SUPER_ADMIN email by school admin', async () => {
      await expect(
        bulkImportUsers([
          {
            name: 'Hijack Super Admin',
            email: 'super@lentera.test',
            role: Role.ADMIN,
          },
        ])
      ).rejects.toThrow(/Gagal mengimpor: Email super@lentera.test sudah terdaftar/);
    });

    it('successfully imports students within the admin school scope', async () => {
      const res = await bulkImportUsers([
        {
          name: 'New Student A',
          email: 'new-student-a@lentera.test',
          role: Role.STUDENT,
        },
      ]);
      expect(res.count).toBe(1);
    });
  });

  describe('QA-15: Course & Content Ownership Protection on Mutators', () => {
    beforeEach(() => {
      actor.id = 'teacher-a';
      actor.role = Role.TEACHER;
      actor.schoolId = 'school-a';
    });

    it('blocks teacher A from updating a module belonging to teacher B', async () => {
      await expect(updateModule('module-b', 'Hacked Module')).rejects.toThrow(/Akses ditolak/);
    });

    it('blocks teacher A from deleting a module belonging to teacher B', async () => {
      await expect(deleteModule('module-b')).rejects.toThrow(/Akses ditolak/);
    });

    it('blocks teacher A from creating content in teacher B module', async () => {
      await expect(
        createContent({
          moduleId: 'module-b',
          title: 'Unauthorized Content',
          type: ContentType.TEXT,
          body: 'Hello',
        })
      ).rejects.toThrow(/Akses ditolak/);
    });

    it('blocks teacher A from deleting content in teacher B module', async () => {
      await expect(deleteContent('content-b')).rejects.toThrow(/Akses ditolak/);
    });

    it('blocks teacher A from updating an assignment in teacher B course', async () => {
      await expect(
        updateAssignment({
          id: 'assignment-b',
          title: 'Hacked Assignment',
        })
      ).rejects.toThrow(/Akses ditolak/);
    });

    it('blocks teacher A from deleting an assignment in teacher B course', async () => {
      await expect(deleteAssignment('assignment-b')).rejects.toThrow(/Akses ditolak/);
    });

    it('blocks teacher A from creating question bank category in teacher B course', async () => {
      await expect(createQuestionBankCategory('course-b', 'Rogue Category')).rejects.toThrow(/Akses ditolak/);
    });

    it('blocks teacher A from deleting question bank category in teacher B course', async () => {
      await expect(deleteQuestionBankCategory('cat-b')).rejects.toThrow(/Akses ditolak/);
    });
  });

  describe('QA-17: Item Analysis & Remedial Authorization Guards', () => {
    it('blocks students from accessing item analysis data', async () => {
      actor.id = 'student-a';
      actor.role = Role.STUDENT;
      actor.schoolId = 'school-a';

      await expect(getItemAnalysisData('quiz-a')).rejects.toThrow(
        /Akses ditolak: Analisis khusus pengajar dan pengawas/
      );
    });

    it('blocks students from accessing remedial eligibility data', async () => {
      actor.id = 'student-a';
      actor.role = Role.STUDENT;
      actor.schoolId = 'school-a';

      await expect(getRemedialEligibleData('quiz-a')).rejects.toThrow(
        /Akses ditolak: Analisis khusus pengajar dan pengawas/
      );
    });

    it('blocks teacher B from viewing item analysis of teacher A quiz', async () => {
      actor.id = 'teacher-b';
      actor.role = Role.TEACHER;
      actor.schoolId = 'school-b';

      await expect(getItemAnalysisData('quiz-a')).rejects.toThrow(/Akses ditolak/);
    });

    it('blocks teacher B from viewing remedial data of teacher A quiz', async () => {
      actor.id = 'teacher-b';
      actor.role = Role.TEACHER;
      actor.schoolId = 'school-b';

      await expect(getRemedialEligibleData('quiz-a')).rejects.toThrow(/Akses ditolak/);
    });

    it('blocks admin B from viewing item analysis of school A quiz', async () => {
      actor.id = 'admin-b';
      actor.role = Role.ADMIN;
      actor.schoolId = 'school-b';

      await expect(getItemAnalysisData('quiz-a')).rejects.toThrow(/Akses ditolak/);
    });
  });

  describe('QA-18: Question Bank Category Binding to Course on Quiz Creation', () => {
    beforeEach(() => {
      actor.id = 'teacher-a';
      actor.role = Role.TEACHER;
      actor.schoolId = 'school-a';
    });

    it('blocks creating a quiz using a question bank category from another course', async () => {
      // Teacher A creates quiz in module-a (course-a), but selects cat-b (which belongs to course-b)
      await expect(
        createQuiz({
          moduleId: 'module-a',
          title: 'Quiz with Foreign Bank Category',
          useQuestionBank: true,
          bankSelections: [
            {
              categoryId: 'cat-b',
              count: 5,
            },
          ],
        })
      ).rejects.toThrow(/Akses ditolak: Kategori bank soal bukan bagian course ini/);
    });

    it('blocks creating a quiz with non-integer or zero question count in bank selections', async () => {
      await expect(
        createQuiz({
          moduleId: 'module-a',
          title: 'Quiz with Invalid Bank Count',
          useQuestionBank: true,
          bankSelections: [
            {
              categoryId: 'cat-a',
              count: 0,
            },
          ],
        })
      ).rejects.toThrow(/Akses ditolak: Kategori bank soal bukan bagian course ini/);
    });

    it('allows creating a quiz when question bank category belongs to the target course', async () => {
      const quiz = await createQuiz({
        moduleId: 'module-a',
        title: 'Valid Bank Quiz',
        useQuestionBank: true,
        bankSelections: [
          {
            categoryId: 'cat-a',
            count: 5,
          },
        ],
      });
      expect(quiz).toBeDefined();
      expect(quiz.title).toBe('Valid Bank Quiz');
    });
  });
});
