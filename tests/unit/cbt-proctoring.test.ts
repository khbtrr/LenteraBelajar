import { describe, it, expect } from 'vitest';

describe('CBT Proctoring & Anti-Cheating Engine', () => {
  describe('Tab Switch Violation & Lockdown Auto-Termination', () => {
    interface AttemptState {
      tabSwitchCount: number;
      isTerminated: boolean;
      submittedAt: Date | null;
      score: number | null;
      terminationReason: string | null;
    }

    interface QuizConfig {
      enableLockdown: boolean;
      maxTabSwitches: number;
    }

    interface AnswerRecord {
      score: number | null;
    }

    function processTabSwitchViolation(
      attempt: AttemptState,
      quiz: QuizConfig,
      answers: AnswerRecord[]
    ) {
      if (attempt.submittedAt !== null) {
        return {
          tabSwitchCount: attempt.tabSwitchCount,
          isTerminated: true,
          message: 'Kuis telah selesai.',
        };
      }

      const updatedCount = attempt.tabSwitchCount + 1;
      const maxAllowed = quiz.maxTabSwitches || 3;
      const reachedLimit = quiz.enableLockdown && updatedCount >= maxAllowed;

      if (reachedLimit) {
        const totalScore = answers.reduce((sum, ans) => sum + (ans.score ?? 0), 0);
        return {
          tabSwitchCount: updatedCount,
          isTerminated: true,
          remainingSwitches: 0,
          terminationReason: `Melebihi batas toleransi meninggalkan layar ujian (${updatedCount}/${maxAllowed})`,
          score: totalScore,
          message: `Ujian Anda otomatis dihentikan dan dikumpulkan karena berpindah tab sebanyak ${updatedCount} kali.`,
        };
      }

      return {
        tabSwitchCount: updatedCount,
        isTerminated: false,
        remainingSwitches: Math.max(0, maxAllowed - updatedCount),
        message: `Peringatan: Anda meninggalkan layar ujian (${updatedCount}/${maxAllowed}). Ujian akan otomatis di-submit jika Anda melanggar lagi!`,
      };
    }

    it('issues warning and updates remaining switch budget when under maximum limit', () => {
      const attempt: AttemptState = {
        tabSwitchCount: 0,
        isTerminated: false,
        submittedAt: null,
        score: null,
        terminationReason: null,
      };
      const quiz: QuizConfig = { enableLockdown: true, maxTabSwitches: 3 };

      const result = processTabSwitchViolation(attempt, quiz, []);

      expect(result.tabSwitchCount).toBe(1);
      expect(result.isTerminated).toBe(false);
      expect(result.remainingSwitches).toBe(2);
      expect(result.message).toContain('Peringatan');
    });

    it('triggers immediate termination and tallies points when violation threshold is reached', () => {
      const attempt: AttemptState = {
        tabSwitchCount: 2,
        isTerminated: false,
        submittedAt: null,
        score: null,
        terminationReason: null,
      };
      const quiz: QuizConfig = { enableLockdown: true, maxTabSwitches: 3 };
      const answers: AnswerRecord[] = [
        { score: 25 },
        { score: 20 },
        { score: null },
      ];

      const result = processTabSwitchViolation(attempt, quiz, answers);

      expect(result.tabSwitchCount).toBe(3);
      expect(result.isTerminated).toBe(true);
      expect(result.remainingSwitches).toBe(0);
      expect(result.score).toBe(45);
      expect(result.terminationReason).toContain('(3/3)');
    });

    it('does not terminate when lockdown is disabled even if switches exceed default threshold', () => {
      const attempt: AttemptState = {
        tabSwitchCount: 4,
        isTerminated: false,
        submittedAt: null,
        score: null,
        terminationReason: null,
      };
      const quiz: QuizConfig = { enableLockdown: false, maxTabSwitches: 3 };

      const result = processTabSwitchViolation(attempt, quiz, []);

      expect(result.tabSwitchCount).toBe(5);
      expect(result.isTerminated).toBe(false);
    });

    it('returns finished status when attempt has already been submitted', () => {
      const attempt: AttemptState = {
        tabSwitchCount: 1,
        isTerminated: false,
        submittedAt: new Date(),
        score: 80,
        terminationReason: null,
      };
      const quiz: QuizConfig = { enableLockdown: true, maxTabSwitches: 3 };

      const result = processTabSwitchViolation(attempt, quiz, []);

      expect(result.isTerminated).toBe(true);
      expect(result.message).toBe('Kuis telah selesai.');
    });
  });

  describe('CBT Token Verification & School Isolation', () => {
    function verifyToken(
      inputToken: string,
      quiz: { requireToken: boolean; token: string | null; schoolId: string },
      userSchoolId: string | null,
      isSuperAdmin: boolean = false
    ): { valid: boolean; error?: string } {
      if (!isSuperAdmin && userSchoolId && quiz.schoolId !== userSchoolId) {
        return { valid: false, error: 'Akses ditolak: Kuis tidak berada dalam sekolah Anda' };
      }

      if (!quiz.requireToken) {
        return { valid: true };
      }

      const cleanInput = inputToken.trim().toUpperCase();
      const cleanQuizToken = (quiz.token || '').trim().toUpperCase();

      return { valid: cleanInput === cleanQuizToken };
    }

    it('allows entry with valid token ignoring case and whitespace', () => {
      const quiz = { requireToken: true, token: 'UJIAN-2026', schoolId: 'school-a' };
      const res = verifyToken('  ujian-2026  ', quiz, 'school-a');

      expect(res.valid).toBe(true);
    });

    it('rejects incorrect exam token', () => {
      const quiz = { requireToken: true, token: 'TOKEN-BENAR', schoolId: 'school-a' };
      const res = verifyToken('TOKEN-SALAH', quiz, 'school-a');

      expect(res.valid).toBe(false);
    });

    it('bypasses token check when requireToken is disabled', () => {
      const quiz = { requireToken: false, token: null, schoolId: 'school-a' };
      const res = verifyToken('', quiz, 'school-a');

      expect(res.valid).toBe(true);
    });

    it('rejects student attempting to access quiz belonging to another school', () => {
      const quiz = { requireToken: true, token: 'VALID123', schoolId: 'school-a' };
      const res = verifyToken('VALID123', quiz, 'school-b');

      expect(res.valid).toBe(false);
      expect(res.error).toContain('Akses ditolak');
    });
  });

  describe('Student Question Option Sanitization', () => {
    interface OptionRaw {
      id: string;
      text: string;
      isCorrect?: boolean;
    }

    function sanitizeQuestionOptions(
      options: OptionRaw[] | null,
      role: 'STUDENT' | 'TEACHER' | 'ADMIN'
    ) {
      if (!options || !Array.isArray(options)) return null;

      if (role === 'STUDENT') {
        return options.map((opt) => ({
          id: opt.id,
          text: opt.text,
        }));
      }

      return options;
    }

    it('strips isCorrect attribute for students preventing browser inspection cheating', () => {
      const rawOptions: OptionRaw[] = [
        { id: 'opt-1', text: 'Pilihan A', isCorrect: false },
        { id: 'opt-2', text: 'Pilihan B', isCorrect: true },
      ];

      const studentView = sanitizeQuestionOptions(rawOptions, 'STUDENT');

      expect(studentView).toEqual([
        { id: 'opt-1', text: 'Pilihan A' },
        { id: 'opt-2', text: 'Pilihan B' },
      ]);
      expect(studentView?.[1]).not.toHaveProperty('isCorrect');
    });

    it('preserves isCorrect attribute for instructors and admins', () => {
      const rawOptions: OptionRaw[] = [
        { id: 'opt-1', text: 'Pilihan A', isCorrect: false },
        { id: 'opt-2', text: 'Pilihan B', isCorrect: true },
      ];

      const teacherView = sanitizeQuestionOptions(rawOptions, 'TEACHER');

      expect(teacherView).toEqual(rawOptions);
      expect(teacherView?.[1]).toHaveProperty('isCorrect', true);
    });
  });

  describe('Student Quiz Payload Token Masking', () => {
    interface QuizPayload {
      id: string;
      title: string;
      token: string | null;
      requireToken: boolean;
    }

    function sanitizeQuizForRole(
      quiz: QuizPayload,
      role: 'STUDENT' | 'TEACHER' | 'ADMIN'
    ): QuizPayload {
      if (role === 'STUDENT') {
        return {
          ...quiz,
          token: null,
        };
      }
      return quiz;
    }

    it('masks secret token to null for student role to prevent pre-exam disclosure', () => {
      const quiz: QuizPayload = {
        id: 'quiz-1',
        title: 'Ujian Akhir Semester',
        token: 'RAHASIA2026',
        requireToken: true,
      };

      const studentView = sanitizeQuizForRole(quiz, 'STUDENT');
      expect(studentView.token).toBeNull();
      expect(studentView.requireToken).toBe(true);
    });

    it('preserves secret token for teacher and admin roles', () => {
      const quiz: QuizPayload = {
        id: 'quiz-1',
        title: 'Ujian Akhir Semester',
        token: 'RAHASIA2026',
        requireToken: true,
      };

      const teacherView = sanitizeQuizForRole(quiz, 'TEACHER');
      expect(teacherView.token).toBe('RAHASIA2026');

      const adminView = sanitizeQuizForRole(quiz, 'ADMIN');
      expect(adminView.token).toBe('RAHASIA2026');
    });
  });
});
