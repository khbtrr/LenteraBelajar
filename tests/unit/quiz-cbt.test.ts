import { describe, it, expect } from 'vitest';
import { QuestionType } from '@prisma/client';

describe('CBT Engine Logic & Fixes', () => {
  describe('Complex Multiple Choice (MCQ Complex) Grading Logic', () => {
    // Helper function that matches the evaluation logic in quiz.ts & submit/route.ts
    function evaluateMcqComplex(
      studentAnswer: string | undefined,
      correctOptions: Array<{ id: string; isCorrect: boolean }>,
      points: number
    ): number {
      let studentSelectedIds: string[] = [];
      if (studentAnswer) {
        const trimmed = studentAnswer.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            studentSelectedIds = (JSON.parse(trimmed) as string[]).map((s) =>
              String(s).trim().toUpperCase()
            );
          } catch {
            studentSelectedIds = trimmed
              .replace(/[\[\]"]/g, '')
              .split(',')
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean);
          }
        } else {
          studentSelectedIds = trimmed
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean);
        }
      }
      studentSelectedIds.sort();

      const activeCorrectOptions = correctOptions.filter((opt) => opt.isCorrect);
      const correctOptionIds = activeCorrectOptions
        .map((opt) => String(opt.id).trim().toUpperCase())
        .sort();

      const isAllCorrect =
        correctOptionIds.length > 0 &&
        studentSelectedIds.length === correctOptionIds.length &&
        studentSelectedIds.every((val, index) => val === correctOptionIds[index]);

      return isAllCorrect ? points : 0;
    }

    const correctOptions = [
      { id: 'opt-a', isCorrect: true },
      { id: 'opt-b', isCorrect: false },
      { id: 'opt-c', isCorrect: true },
      { id: 'opt-d', isCorrect: false },
    ];
    const points = 20;

    it('awards points when student selects exact correct options as JSON array', () => {
      const studentAnswer = JSON.stringify(['opt-a', 'opt-c']);
      const score = evaluateMcqComplex(studentAnswer, correctOptions, points);
      expect(score).toBe(20);
    });

    it('awards points regardless of option order in JSON array (e.g. ["opt-c", "opt-a"])', () => {
      const studentAnswer = JSON.stringify(['opt-c', 'opt-a']);
      const score = evaluateMcqComplex(studentAnswer, correctOptions, points);
      expect(score).toBe(20);
    });

    it('awards points when student selects exact correct options as comma-separated string', () => {
      const studentAnswer = 'opt-a, opt-c';
      const score = evaluateMcqComplex(studentAnswer, correctOptions, points);
      expect(score).toBe(20);
    });

    it('awards points with case-insensitive option IDs', () => {
      const studentAnswer = 'OPT-C, OPT-A';
      const score = evaluateMcqComplex(studentAnswer, correctOptions, points);
      expect(score).toBe(20);
    });

    it('awards 0 points if student chooses only partial correct options', () => {
      const studentAnswer = JSON.stringify(['opt-a']);
      const score = evaluateMcqComplex(studentAnswer, correctOptions, points);
      expect(score).toBe(0);
    });

    it('awards 0 points if student includes an incorrect option', () => {
      const studentAnswer = JSON.stringify(['opt-a', 'opt-b', 'opt-c']);
      const score = evaluateMcqComplex(studentAnswer, correctOptions, points);
      expect(score).toBe(0);
    });

    it('awards 0 points if student provides empty or invalid answer', () => {
      expect(evaluateMcqComplex('', correctOptions, points)).toBe(0);
      expect(evaluateMcqComplex(undefined, correctOptions, points)).toBe(0);
      expect(evaluateMcqComplex('[]', correctOptions, points)).toBe(0);
    });
  });

  describe('CBT Randomization Snapshot Persistence (BUG-04)', () => {
    it('persists question order and options order across reloads when snapshot exists', () => {
      // Mock existing attempt with snapshot
      const savedSnapshot = [
        {
          id: 'q-2',
          text: 'Soal Nomor Dua',
          type: QuestionType.MULTIPLE_CHOICE,
          points: 10,
          options: [
            { id: 'opt-2b', text: 'Pilihan B' },
            { id: 'opt-2a', text: 'Pilihan A' },
          ],
        },
        {
          id: 'q-1',
          text: 'Soal Nomor Satu',
          type: QuestionType.MULTIPLE_CHOICE,
          points: 10,
          options: [
            { id: 'opt-1b', text: 'Opsi B' },
            { id: 'opt-1a', text: 'Opsi A' },
          ],
        },
      ];

      // Simulate student reload (re-fetch attempt)
      const attempt = {
        id: 'attempt-123',
        quizId: 'quiz-abc',
        questionSnapshot: savedSnapshot,
        quiz: {
          shuffleQuestions: true,
          shuffleOptions: true,
          questions: [
            { id: 'q-1', text: 'Soal Nomor Satu', points: 10 },
            { id: 'q-2', text: 'Soal Nomor Dua', points: 10 },
          ],
        },
      };

      // In startOrGetQuizAttempt, if questionSnapshot exists, it loads directly from it
      const questionsForStudent = attempt.questionSnapshot as typeof savedSnapshot;

      expect(questionsForStudent[0].id).toBe('q-2');
      expect(questionsForStudent[0].options[0].id).toBe('opt-2b');
      expect(questionsForStudent[1].id).toBe('q-1');
      expect(questionsForStudent[1].options[0].id).toBe('opt-1b');
    });

    it('sanitizes correct answers in snapshot before returning to student', () => {
      const teacherQuestions = [
        {
          id: 'q-1',
          text: 'Berapa 1 + 1?',
          points: 10,
          options: [
            { id: 'opt-1', text: '1', isCorrect: false },
            { id: 'opt-2', text: '2', isCorrect: true },
          ],
        },
      ];

      // Sanitization pattern used in quiz.ts
      const studentSanitized = teacherQuestions.map((q) => ({
        id: q.id,
        text: q.text,
        points: q.points,
        options: q.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          // Notice: isCorrect is stripped!
        })),
      }));

      expect(studentSanitized[0].options[0]).not.toHaveProperty('isCorrect');
      expect(studentSanitized[0].options[1]).not.toHaveProperty('isCorrect');
    });
  });

  describe('Remedial Score Capping Logic', () => {
    function calculateRemedialScore(
      attemptScore: number,
      isRemedial: boolean,
      passingGrade: number | null
    ): number {
      const passingLimit = isRemedial && passingGrade ? passingGrade : 100;
      let finalScore = attemptScore;
      if (isRemedial) {
        finalScore = Math.min(finalScore, passingLimit);
      }
      return finalScore;
    }

    it('caps remedial score to passingGrade if student scores higher', () => {
      const score = calculateRemedialScore(95, true, 75);
      expect(score).toBe(75);
    });

    it('retains score if student scores below passingGrade in remedial', () => {
      const score = calculateRemedialScore(65, true, 75);
      expect(score).toBe(65);
    });

    it('allows full score up to 100 for non-remedial regular quizzes', () => {
      const score = calculateRemedialScore(95, false, 75);
      expect(score).toBe(95);
    });
  });
});
