import { describe, it, expect, vi, beforeEach } from 'vitest';

const authUser = vi.hoisted(() => ({ id: 'student-1', role: 'STUDENT', schoolId: 'school-1', name: 'Student 1' }));
const mockAssignment = vi.hoisted(() => ({
  id: 'assignment-1',
  title: 'Tugas Matematika',
  deadline: null as Date | null,
  module: {
    course: {
      id: 'course-1',
      title: 'Matematika X',
      teacherId: 'teacher-1',
    },
  },
}));

const existingSubmission = vi.hoisted(() => ({
  value: null as null | Record<string, unknown>,
}));

const awardedXpCalls = vi.hoisted(() => [] as unknown[][]);

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: async () => ({ user: authUser }),
}));

vi.mock('@/lib/access', () => ({
  assertItemAccess: async () => {},
}));

vi.mock('@/lib/actions/cohort-access', () => ({
  checkStudentItemAccess: async () => true,
}));

vi.mock('@/lib/files', () => ({
  assertFileReferences: async (fileUrl: string) => {
    if (fileUrl === '/api/files/valid.pdf') {
      return [{ id: 'asset-1', filename: 'valid.pdf', uploaderId: authUser.id }];
    }
    return [];
  },
  bindFileReferences: async () => {},
}));

vi.mock('@/lib/notifications', () => ({
  createNotification: async () => {},
}));

vi.mock('@/lib/gamification', () => ({
  awardXp: async (...args: unknown[]) => {
    awardedXpCalls.push(args);
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}));

vi.mock('@/lib/db', () => ({
  db: {
    assignment: {
      findUnique: async () => mockAssignment,
    },
    $transaction: async (cb: (tx: any) => Promise<any>) => {
      const tx = {
        assignmentSubmission: {
          findUnique: async () => existingSubmission.value,
          upsert: async ({ create, update }: any) => {
            const data = existingSubmission.value ? update : create;
            return { id: 'sub-1', ...data };
          },
        },
      };
      return cb(tx);
    },
  },
}));

import { submitAssignment } from '@/lib/actions/assignment';

describe('Assignment submission URL guard (Finding #4)', () => {
  beforeEach(() => {
    existingSubmission.value = null;
    awardedXpCalls.length = 0;
  });

  it('rejects external http and https schemes', async () => {
    await expect(
      submitAssignment({
        assignmentId: 'assignment-1',
        fileUrl: 'https://evil.com/phish.pdf',
        fileName: 'report.pdf',
        fileSize: 1024,
      })
    ).rejects.toThrow('URL berkas harus berupa berkas internal (/api/files/)');

    await expect(
      submitAssignment({
        assignmentId: 'assignment-1',
        fileUrl: 'http://evil.com/phish.pdf',
        fileName: 'report.pdf',
        fileSize: 1024,
      })
    ).rejects.toThrow('URL berkas harus berupa berkas internal (/api/files/)');
  });

  it('rejects dangerous URI schemes (javascript: and data:)', async () => {
    await expect(
      submitAssignment({
        assignmentId: 'assignment-1',
        fileUrl: 'javascript:alert(1)',
        fileName: 'report.pdf',
        fileSize: 1024,
      })
    ).rejects.toThrow('URL berkas harus berupa berkas internal (/api/files/)');

    await expect(
      submitAssignment({
        assignmentId: 'assignment-1',
        fileUrl: 'data:text/html,<script>alert(1)</script>',
        fileName: 'report.pdf',
        fileSize: 1024,
      })
    ).rejects.toThrow('URL berkas harus berupa berkas internal (/api/files/)');
  });

  it('rejects empty or whitespace fileName', async () => {
    await expect(
      submitAssignment({
        assignmentId: 'assignment-1',
        fileUrl: '/api/files/valid.pdf',
        fileName: '   ',
        fileSize: 1024,
      })
    ).rejects.toThrow('Nama berkas tidak valid');
  });

  it('rejects fileUrl not passing asset validation', async () => {
    await expect(
      submitAssignment({
        assignmentId: 'assignment-1',
        fileUrl: '/api/files/unregistered.pdf',
        fileName: 'unregistered.pdf',
        fileSize: 1024,
      })
    ).rejects.toThrow('Berkas lampiran tidak ditemukan atau tidak valid');
  });

  it('accepts valid internal /api/files/ reference with registered asset', async () => {
    const res = await submitAssignment({
      assignmentId: 'assignment-1',
      fileUrl: '/api/files/valid.pdf',
      fileName: 'valid.pdf',
      fileSize: 2048,
    });

    expect(res).toBeDefined();
    expect(res.fileUrl).toBe('/api/files/valid.pdf');
    expect(res.fileName).toBe('valid.pdf');
  });
});

describe('Assignment submission uniqueness and compound XP idempotency (Finding #3)', () => {
  beforeEach(() => {
    existingSubmission.value = null;
    awardedXpCalls.length = 0;
  });

  it('awards XP with compound key on initial submission', async () => {
    await submitAssignment({
      assignmentId: 'assignment-1',
      fileUrl: '/api/files/valid.pdf',
      fileName: 'valid.pdf',
      fileSize: 2048,
    });

    expect(awardedXpCalls.length).toBe(1);
    const [userId, xp, reason, actionType, courseId, eventKey] = awardedXpCalls[0];
    expect(userId).toBe('student-1');
    expect(actionType).toBe('ASSIGNMENT');
    expect(courseId).toBe('course-1');
    expect(eventKey).toBe('ASSIGNMENT:student-1:assignment-1');
  });

  it('does not re-award XP on update/resubmission before grading', async () => {
    existingSubmission.value = {
      id: 'sub-existing',
      score: null,
      gradedAt: null,
      fileUrl: '/api/files/old.pdf',
      fileName: 'old.pdf',
      fileSize: 1024,
    };

    const res = await submitAssignment({
      assignmentId: 'assignment-1',
      fileUrl: '/api/files/valid.pdf',
      fileName: 'valid.pdf',
      fileSize: 2048,
    });

    expect(res).toBeDefined();
    expect(awardedXpCalls.length).toBe(0);
  });

  it('blocks resubmission when assignment has already been graded', async () => {
    existingSubmission.value = {
      id: 'sub-graded',
      score: 90,
      gradedAt: new Date(),
      fileUrl: '/api/files/old.pdf',
      fileName: 'old.pdf',
      fileSize: 1024,
    };

    await expect(
      submitAssignment({
        assignmentId: 'assignment-1',
        fileUrl: '/api/files/valid.pdf',
        fileName: 'valid.pdf',
        fileSize: 2048,
      })
    ).rejects.toThrow('Tugas yang sudah dinilai tidak dapat diubah atau dikumpulkan ulang.');
  });
});
