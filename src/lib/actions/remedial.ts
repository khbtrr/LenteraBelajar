'use server';

import { db } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/auth-utils';
import { assertItemAccess } from '@/lib/access';
import { revalidatePath } from 'next/cache';
import { createBulkNotifications } from '@/lib/notifications';
import { loadQuizAnalysis, questionVersion } from '@/lib/quiz-analysis';
import { loadCourseGrades } from '@/lib/course-grades';

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
  const { session } = await assertItemAccess('QUIZ', quizId);
  if (session.user.role === 'STUDENT') throw new Error('Akses ditolak: Analisis khusus pengajar dan pengawas');
  const source = await loadQuizAnalysis(quizId);
  const grades = await loadCourseGrades(source.quiz.module.courseId, source.attempts.map((attempt) => attempt.userId));
  const failing = source.attempts.filter((attempt) => (grades.scores.get(attempt.userId)?.quiz[quizId] ?? attempt.score!) < (source.quiz.passingGrade ?? 75));
  const failures = new Map<string, number>();
  const remedialStudents = failing.map((attempt) => {
    const wrongQuestionIds = (source.snapshots.get(attempt.id) ?? []).filter((question) => {
      const answer = attempt.answers.find((item) => item.questionId === question.id);
      return answer?.score === null || answer?.score === undefined || answer.score < question.points * (question.type === 'ESSAY' ? 0.6 : 1);
    }).map((question) => { const version = questionVersion(question); failures.set(version, (failures.get(version) ?? 0) + 1); return version; });
    return { userId: attempt.userId, name: attempt.user.name, nis: attempt.user.nis, email: attempt.user.email,
      bestScore: grades.scores.get(attempt.userId)?.quiz[quizId] ?? attempt.score!, submittedAt: attempt.submittedAt, wrongQuestionIds };
  });
  const remedials = await db.quiz.findMany({ where: { parentQuizId: quizId }, include: { _count: { select: { attempts: true, questions: true } } }, orderBy: { createdAt: 'desc' } });
  return {
    quiz: { id: quizId, title: source.quiz.title, courseId: source.quiz.module.courseId, moduleId: source.quiz.moduleId, passingGrade: source.quiz.passingGrade ?? 75 },
    remedialStudents,
    mostFailedQuestions: [...source.questions].map(([version, question]) => ({ questionId: version, text: question.text, type: question.type, points: question.points,
      failCount: failures.get(version) ?? 0, failPercentage: failing.length ? Math.round((failures.get(version) ?? 0) / failing.length * 100) : 0 })).sort((left, right) => right.failCount - left.failCount),
    existingRemedials: remedials.map(({ id, title, createdAt, isPublished, _count }) => ({ id, title, createdAt, isPublished, _count })),
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
  await assertItemAccess('QUIZ', data.parentQuizId, 'manage');

  const parentQuiz = await db.quiz.findUnique({
    where: { id: data.parentQuizId },
    include: {
      questions: true,
      module: true,
    },
  });

  if (!parentQuiz) throw new Error('Kuis induk tidak ditemukan');

  // Filter questions to copy
  const source = await loadQuizAnalysis(data.parentQuizId);
  const eligibility = await getRemedialEligibleData(data.parentQuizId);
  const eligibleIds = new Set(eligibility?.remedialStudents.map((student) => student.userId));
  if (!data.targetStudentIds.length || data.targetStudentIds.some((id) => !eligibleIds.has(id))) throw new Error('Peserta remedial tidak memenuhi syarat');
  const questionsToCopy = data.selectedQuestionIds.map((id) => source.questions.get(id)).filter((question) => question !== undefined);
  if (questionsToCopy.length !== new Set(data.selectedQuestionIds).size) throw new Error('Versi soal remedial tidak valid');

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
          options: q._correctData ? JSON.parse(JSON.stringify(q._correctData)) : null,
          points: q.points,
          order: idx + 1,
        })),
      },
    },
    include: {
      questions: true,
    },
  });

  // Notify targeted remedial students
  try {
    if (data.targetStudentIds && data.targetStudentIds.length > 0) {
      await createBulkNotifications(data.targetStudentIds, {
        title: `Program Remedial: ${remedialQuiz.title}`,
        message: `Anda didaftarkan pada kuis remedial untuk ${parentQuiz.title}. Silakan kerjakan untuk memperbaiki nilai Anda.`,
        type: 'REMEDIAL',
        link: `/student/course/${parentQuiz.module.courseId}/quiz/${remedialQuiz.id}`,
      });
    }
  } catch (err) {
    console.error('Failed to notify remedial students on generateRemedialQuiz:', err);
  }

  revalidatePath(`/teacher/course/${parentQuiz.module.courseId}/modules`);
  revalidatePath(`/teacher/course/${parentQuiz.module.courseId}/quiz-attempts/${parentQuiz.id}`);
  revalidatePath(`/student/course/${parentQuiz.module.courseId}/modules`);

  return remedialQuiz;
}
