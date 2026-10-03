import { describe, it, expect } from 'vitest';

describe('Grading Boundary Clamping & Authorization (BUG-02)', () => {
  describe('Boundary Clamping Logic', () => {
    function clampScore(inputScore: number, maxScore: number = 100): number {
      return Math.max(0, Math.min(Number(inputScore) || 0, maxScore));
    }

    it('clamps negative score to 0', () => {
      expect(clampScore(-15, 100)).toBe(0);
      expect(clampScore(-0.5, 100)).toBe(0);
    });

    it('clamps score higher than maxScore to maxScore', () => {
      expect(clampScore(125, 100)).toBe(100);
      expect(clampScore(55, 50)).toBe(50);
    });

    it('preserves valid score within [0, maxScore] range', () => {
      expect(clampScore(85.5, 100)).toBe(85.5);
      expect(clampScore(0, 100)).toBe(0);
      expect(clampScore(100, 100)).toBe(100);
      expect(clampScore(45, 50)).toBe(45);
    });

    it('handles NaN or undefined gracefully by returning 0', () => {
      expect(clampScore(NaN, 100)).toBe(0);
      expect(clampScore(undefined as any, 100)).toBe(0);
    });
  });

  describe('Grading Role & Course Ownership Verification', () => {
    interface GradingSession {
      user: {
        id: string;
        role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';
        schoolId: string;
      };
    }

    interface GradingCourse {
      teacherId: string;
      schoolId: string;
    }

    function verifyGradingAuthority(session: GradingSession, course: GradingCourse) {
      if (!['TEACHER', 'ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
        throw new Error('Akses ditolak: Hanya pengajar dan admin yang dapat menilai tugas.');
      }

      if (session.user.role === 'TEACHER' && course.teacherId !== session.user.id) {
        throw new Error('Akses ditolak: Anda bukan pengajar untuk kursus ini.');
      }

      if (session.user.role === 'ADMIN' && course.schoolId !== session.user.schoolId) {
        throw new Error('Akses ditolak: Kursus tidak berada di sekolah Anda.');
      }

      return true;
    }

    const schoolX = 'school-x-id';
    const schoolY = 'school-y-id';

    const courseX: GradingCourse = {
      teacherId: 'teacher-x',
      schoolId: schoolX,
    };

    it('allows assigned teacher to grade submission', () => {
      const session: GradingSession = {
        user: { id: 'teacher-x', role: 'TEACHER', schoolId: schoolX },
      };
      expect(() => verifyGradingAuthority(session, courseX)).not.toThrow();
    });

    it('rejects another teacher from grading submission', () => {
      const session: GradingSession = {
        user: { id: 'teacher-other', role: 'TEACHER', schoolId: schoolX },
      };
      expect(() => verifyGradingAuthority(session, courseX)).toThrowError(
        'Akses ditolak: Anda bukan pengajar untuk kursus ini.'
      );
    });

    it('allows school admin to grade/override submission in their school', () => {
      const session: GradingSession = {
        user: { id: 'admin-x', role: 'ADMIN', schoolId: schoolX },
      };
      expect(() => verifyGradingAuthority(session, courseX)).not.toThrow();
    });

    it('rejects admin from another school from grading', () => {
      const session: GradingSession = {
        user: { id: 'admin-y', role: 'ADMIN', schoolId: schoolY },
      };
      expect(() => verifyGradingAuthority(session, courseX)).toThrowError(
        'Akses ditolak: Kursus tidak berada di sekolah Anda.'
      );
    });

    it('strictly rejects students from grading their own or peers submissions', () => {
      const session: GradingSession = {
        user: { id: 'student-x', role: 'STUDENT', schoolId: schoolX },
      };
      expect(() => verifyGradingAuthority(session, courseX)).toThrowError(
        'Akses ditolak: Hanya pengajar dan admin yang dapat menilai tugas.'
      );
    });
  });
});
