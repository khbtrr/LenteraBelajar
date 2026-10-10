import { describe, it, expect } from 'vitest';

describe('Remedial Exam & KKM Evaluation Engine', () => {
  describe('Student Remedial Eligibility Detection', () => {
    interface AttemptData {
      userId: string;
      score: number | null;
      answers: Array<{
        questionId: string;
        answer?: string;
        score?: number | null;
      }>;
    }

    interface QuestionData {
      id: string;
      type: 'MULTIPLE_CHOICE' | 'ESSAY';
      points: number;
      options?: Array<{ id: string; isCorrect: boolean }>;
    }

    function evaluateRemedialEligibility(
      attempts: AttemptData[],
      questions: QuestionData[],
      passingGrade: number = 75
    ) {
      const studentBestAttemptMap = new Map<string, AttemptData>();
      for (const att of attempts) {
        const existing = studentBestAttemptMap.get(att.userId);
        if (!existing || (att.score !== null && (existing.score === null || att.score > existing.score))) {
          studentBestAttemptMap.set(att.userId, att);
        }
      }

      const remedialStudents: Array<{
        userId: string;
        bestScore: number;
        wrongQuestionIds: string[];
      }> = [];

      const questionFailCountMap: Record<string, number> = {};
      questions.forEach((q) => {
        questionFailCountMap[q.id] = 0;
      });

      studentBestAttemptMap.forEach((att) => {
        const score = att.score ?? 0;
        if (score < passingGrade) {
          const wrongQuestionIds: string[] = [];

          questions.forEach((q) => {
            const ans = att.answers.find((a) => a.questionId === q.id);
            let isCorrect = false;

            if (q.type === 'MULTIPLE_CHOICE') {
              const correctOpt = q.options?.find((o) => o.isCorrect);
              if (ans?.answer && correctOpt && ans.answer === correctOpt.id) {
                isCorrect = true;
              }
            } else {
              // Essay passing threshold: >= 60% of max question points
              if (ans?.score !== null && ans?.score !== undefined && ans.score >= q.points * 0.6) {
                isCorrect = true;
              }
            }

            if (!isCorrect) {
              wrongQuestionIds.push(q.id);
              questionFailCountMap[q.id] = (questionFailCountMap[q.id] || 0) + 1;
            }
          });

          remedialStudents.push({
            userId: att.userId,
            bestScore: score,
            wrongQuestionIds,
          });
        }
      });

      const totalRemedial = remedialStudents.length;
      const questionStats = questions
        .map((q) => ({
          questionId: q.id,
          failCount: questionFailCountMap[q.id] || 0,
          failPercentage: totalRemedial > 0 ? Math.round((questionFailCountMap[q.id] / totalRemedial) * 100) : 0,
        }))
        .sort((a, b) => b.failCount - a.failCount);

      return {
        remedialStudents,
        questionStats,
      };
    }

    const testQuestions: QuestionData[] = [
      {
        id: 'q1',
        type: 'MULTIPLE_CHOICE',
        points: 50,
        options: [
          { id: 'opt-a', isCorrect: true },
          { id: 'opt-b', isCorrect: false },
        ],
      },
      {
        id: 'q2',
        type: 'ESSAY',
        points: 50,
      },
    ];

    it('filters out students who meet or exceed passing grade (KKM)', () => {
      const attempts: AttemptData[] = [
        {
          userId: 'student-pass',
          score: 85,
          answers: [
            { questionId: 'q1', answer: 'opt-a' },
            { questionId: 'q2', score: 40 },
          ],
        },
      ];

      const result = evaluateRemedialEligibility(attempts, testQuestions, 75);
      expect(result.remedialStudents).toHaveLength(0);
    });

    it('includes students whose score is strictly below passing grade', () => {
      const attempts: AttemptData[] = [
        {
          userId: 'student-fail',
          score: 60,
          answers: [
            { questionId: 'q1', answer: 'opt-b' }, // wrong
            { questionId: 'q2', score: 35 }, // pass essay (35 >= 30)
          ],
        },
      ];

      const result = evaluateRemedialEligibility(attempts, testQuestions, 75);
      expect(result.remedialStudents).toHaveLength(1);
      expect(result.remedialStudents[0].userId).toBe('student-fail');
      expect(result.remedialStudents[0].wrongQuestionIds).toEqual(['q1']);
    });

    it('uses best score when a student has multiple quiz attempts', () => {
      const attempts: AttemptData[] = [
        {
          userId: 'student-retry',
          score: 40,
          answers: [{ questionId: 'q1', answer: 'opt-b' }],
        },
        {
          userId: 'student-retry',
          score: 80,
          answers: [{ questionId: 'q1', answer: 'opt-a' }],
        },
      ];

      const result = evaluateRemedialEligibility(attempts, testQuestions, 75);
      expect(result.remedialStudents).toHaveLength(0);
    });

    it('calculates question failure percentage ranking correctly', () => {
      const attempts: AttemptData[] = [
        {
          userId: 'student-1',
          score: 20,
          answers: [
            { questionId: 'q1', answer: 'opt-b' },
            { questionId: 'q2', score: 10 }, // essay fail (10 < 30)
          ],
        },
        {
          userId: 'student-2',
          score: 50,
          answers: [
            { questionId: 'q1', answer: 'opt-b' },
            { questionId: 'q2', score: 40 }, // essay pass
          ],
        },
      ];

      const result = evaluateRemedialEligibility(attempts, testQuestions, 75);
      expect(result.remedialStudents).toHaveLength(2);

      const topFailed = result.questionStats[0];
      expect(topFailed.questionId).toBe('q1');
      expect(topFailed.failCount).toBe(2);
      expect(topFailed.failPercentage).toBe(100);

      const secondFailed = result.questionStats[1];
      expect(secondFailed.questionId).toBe('q2');
      expect(secondFailed.failCount).toBe(1);
      expect(secondFailed.failPercentage).toBe(50);
    });
  });

  describe('Remedial Quiz Generator Validation', () => {
    function validateRemedialCreation(data: {
      parentQuizId: string;
      selectedQuestionIds: string[];
      targetStudentIds: string[];
    }) {
      if (!data.parentQuizId) {
        throw new Error('Kuis induk tidak ditemukan');
      }
      if (!data.selectedQuestionIds || data.selectedQuestionIds.length === 0) {
        throw new Error('Pilih minimal satu butir soal untuk kuis remedial');
      }
      if (!data.targetStudentIds || data.targetStudentIds.length === 0) {
        throw new Error('Pilih minimal satu siswa sasaran remedial');
      }
      return true;
    }

    it('requires at least one question to be selected for remedial', () => {
      expect(() =>
        validateRemedialCreation({
          parentQuizId: 'quiz-1',
          selectedQuestionIds: [],
          targetStudentIds: ['student-1'],
        })
      ).toThrow('Pilih minimal satu butir soal untuk kuis remedial');
    });

    it('requires target student recipients to be specified', () => {
      expect(() =>
        validateRemedialCreation({
          parentQuizId: 'quiz-1',
          selectedQuestionIds: ['q-1'],
          targetStudentIds: [],
        })
      ).toThrow('Pilih minimal satu siswa sasaran remedial');
    });

    it('passes validation when valid parameters are provided', () => {
      expect(
        validateRemedialCreation({
          parentQuizId: 'quiz-1',
          selectedQuestionIds: ['q-1', 'q-2'],
          targetStudentIds: ['student-1', 'student-2'],
        })
      ).toBe(true);
    });
  });
});
