'use server';

import { db } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';

export interface RemedialStudentInfo {
  userId: string;
  name: string;
  nis: string | null;
  email: string;
  bestScore: number;
  submittedAt: Date | null;
  wrongQuestionIds: string[];
}

export interface RemedialEligibleData {
  quiz: {
    id: string;
    title: string;
    passingGrade: number;
    courseId: string;
    moduleId: string;
  };
  remedialStudents: RemedialStudentInfo[];
  mostFailedQuestions: Array<{
    questionId: string;
    text: string;
    type: string;
    points: number;
    failCount: number;
    failPercentage: number;
  }>;
  existingRemedials: Array<{
    id: string;
    title: string;
    createdAt: Date;
    isPublished: boolean;
    _count: {
      attempts: number;
      questions: number;
    };
  }>;
}

export async function getRemedialEligibleData(quizId: string): Promise<RemedialEligibleData | null> {
  await requireAuth();

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      module: {
        include: { course: true },
      },
      questions: {
        orderBy: { order: 'asc' },
      },
      attempts: {
        where: { submittedAt: { not: null } },
        include: {
          user: {
            select: { id: true, name: true, nis: true, email: true },
          },
          answers: true,
        },
        orderBy: { score: 'desc' },
      },
      remedials: {
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { attempts: true, questions: true },
          },
        },
      },
    },
  });

  if (!quiz) return null;

  const passingGrade = quiz.passingGrade ?? 75;

  // Group by student to find their best submitted attempt
  const studentBestAttemptMap = new Map<string, typeof quiz.attempts[0]>();

  quiz.attempts.forEach((att) => {
    const existing = studentBestAttemptMap.get(att.userId);
    if (!existing || (att.score !== null && (existing.score === null || att.score > existing.score))) {
      studentBestAttemptMap.set(att.userId, att);
    }
  });

  const remedialStudents: RemedialStudentInfo[] = [];
  const questionFailCountMap: Record<string, number> = {};

  quiz.questions.forEach((q) => {
    questionFailCountMap[q.id] = 0;
  });

  studentBestAttemptMap.forEach((att) => {
    const score = att.score ?? 0;
    if (score < passingGrade) {
      const wrongQuestionIds: string[] = [];

      quiz.questions.forEach((q) => {
        const ans = att.answers.find((a) => a.questionId === q.id);
        const options = (q.options as any[]) || [];
        const correctOpt = options.find((o) => o.isCorrect);

        let isCorrect = false;
        if (q.type === 'MULTIPLE_CHOICE') {
          if (ans?.answer && correctOpt && ans.answer === correctOpt.id) {
            isCorrect = true;
          }
        } else {
          // Essay: >= 60% points considered passing
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
        name: att.user.name,
        nis: att.user.nis,
        email: att.user.email,
        bestScore: score,
        submittedAt: att.submittedAt,
        wrongQuestionIds,
      });
    }
  });

  const totalRemedialCount = remedialStudents.length;

  const mostFailedQuestions = quiz.questions
    .map((q) => {
      const failCount = questionFailCountMap[q.id] || 0;
      const failPercentage = totalRemedialCount > 0 ? Math.round((failCount / totalRemedialCount) * 100) : 0;
      return {
        questionId: q.id,
        text: q.text,
        type: q.type,
        points: q.points,
        failCount,
        failPercentage,
      };
    })
    .sort((a, b) => b.failCount - a.failCount);

  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      passingGrade,
      courseId: quiz.module.courseId,
      moduleId: quiz.moduleId,
    },
    remedialStudents,
    mostFailedQuestions,
    existingRemedials: quiz.remedials.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      isPublished: r.isPublished,
      _count: r._count,
    })),
  };
}

export async function generateRemedialQuiz(data: {
  parentQuizId: string;
  title: string;
  description?: string;
  selectedQuestionIds: string[];
  targetStudentIds: string[];
  durationMinutes?: number;
  deadline?: string;
  passingGrade?: number;
}) {
  const session = await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const parentQuiz = await db.quiz.findUnique({
    where: { id: data.parentQuizId },
    include: {
      questions: true,
      module: true,
    },
  });

  if (!parentQuiz) throw new Error('Kuis induk tidak ditemukan');

  // Filter questions to copy
  const questionsToCopy = parentQuiz.questions.filter((q) =>
    data.selectedQuestionIds.includes(q.id)
  );

  if (questionsToCopy.length === 0) {
    throw new Error('Pilih minimal satu butir soal untuk kuis remedial');
  }

  // Create remedial quiz in the same module
  const remedialQuiz = await db.quiz.create({
    data: {
      moduleId: parentQuiz.moduleId,
      title: data.title.trim(),
      description:
        data.description ||
        `Kuis remedial untuk ${parentQuiz.title}. Nilai maksimal yang dicatat ke Buku Nilai disesuaikan dengan KKM (${parentQuiz.passingGrade || 75}).`,
      duration: data.durationMinutes || parentQuiz.duration,
      deadline: data.deadline ? new Date(data.deadline) : parentQuiz.deadline,
      shuffleQuestions: parentQuiz.shuffleQuestions,
      shuffleOptions: parentQuiz.shuffleOptions,
      questionsPerPage: parentQuiz.questionsPerPage,
      isPublished: true,
      maxAttempts: 1,
      passingGrade: data.passingGrade || parentQuiz.passingGrade,
      requireToken: false,
      enableLockdown: parentQuiz.enableLockdown,
      maxTabSwitches: parentQuiz.maxTabSwitches,
      isRemedial: true,
      parentQuizId: parentQuiz.id,
      targetStudentIds: data.targetStudentIds,
      questions: {
        create: questionsToCopy.map((q, idx) => ({
          type: q.type,
          text: q.text,
          options: q.options ? JSON.parse(JSON.stringify(q.options)) : null,
          points: q.points,
          order: idx + 1,
        })),
      },
    },
    include: {
      questions: true,
    },
  });

  revalidatePath(`/teacher/course/${parentQuiz.module.courseId}/modules`);
  revalidatePath(`/teacher/course/${parentQuiz.module.courseId}/quiz-attempts/${parentQuiz.id}`);
  revalidatePath(`/student/course/${parentQuiz.module.courseId}/modules`);

  return remedialQuiz;
}
