'use server';

import { db } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/auth-utils';
import { QuestionType, GradeType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { createBulkNotifications } from '@/lib/notifications';
import { awardXp } from '@/lib/gamification';
import { checkStudentItemAccess } from './cohort-access';
import { assertItemAccess, assertModuleAccess, assertCourseAccess } from '@/lib/access';
import { startQuiz, submitQuiz } from '@/lib/cbt';
import { assertFileReferences, bindFileReferences } from '@/lib/files';

export async function getQuizById(quizId: string) {
  const { session } = await assertItemAccess('QUIZ', quizId);

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      module: {
        include: {
          course: true,
        },
      },
      cohortAccess: {
        include: {
          cohort: { select: { id: true, name: true } },
        },
      },
      questions: {
        orderBy: { order: 'asc' },
      },
      attempts: {
        where: { userId: session.user.id },
        orderBy: { startedAt: 'desc' },
        include: {
          answers: true,
        },
      },
      _count: {
        select: {
          questions: true,
          attempts: true,
        },
      },
    },
  });

  if (!quiz) return null;

  if (session.user.role === 'STUDENT') {
    const hasAccess = await checkStudentItemAccess({
      userId: session.user.id,
      itemType: 'QUIZ',
      itemId: quizId,
      courseId: quiz.module.courseId,
    });
    if (!hasAccess) {
      return null;
    }

    quiz.token = null;
    quiz.attempts = quiz.attempts.map((attempt) => ({ ...attempt, questionSnapshot: null }));

    // Sanitize question options so students cannot inspect correct answers before taking quiz
    if (quiz.questions && Array.isArray(quiz.questions)) {
      quiz.questions = quiz.questions.map((q) => {
        let sanitizedOptions = null;
        if (q.options && Array.isArray(q.options)) {
          sanitizedOptions = (q.options as any[]).map((opt) => ({
            id: opt.id,
            text: opt.text,
          }));
        }
        return {
          ...q,
          options: sanitizedOptions,
        };
      });
    }
  }

  return quiz;
}

export async function createQuiz(data: {
  moduleId: string;
  title: string;
  description?: string;
  duration?: number;
  deadline?: string;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  questionsPerPage?: number;
  maxAttempts?: number | null;
  passingGrade?: number | null;
  useQuestionBank?: boolean;
  bankSelections?: { categoryId: string; count: number }[];
  requireToken?: boolean;
  token?: string;
  enableLockdown?: boolean;
  maxTabSwitches?: number;
}) {
  const session = await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');
  const { course: targetCourse } = await assertModuleAccess(data.moduleId, 'manage');
  for (const selection of data.bankSelections ?? []) {
    if (!Number.isSafeInteger(selection.count) || selection.count < 1 || !await db.questionBankCategory.findFirst({
      where: { id: selection.categoryId, courseId: targetCourse.id }, select: { id: true },
    })) throw new Error('Akses ditolak: Kategori bank soal bukan bagian course ini');
  }

  // Retrieve school defaults if any field is not explicitly provided
  const moduleItem = await db.module.findUnique({
    where: { id: data.moduleId },
    select: {
      course: {
        select: {
          id: true,
          teacherId: true,
          schoolId: true,
          school: {
            select: {
              defaultPassingGrade: true,
              cbtLockdownEnabled: true,
              cbtMaxTabSwitches: true,
              cbtRequireToken: true,
              cbtShuffleQuestions: true,
              cbtShuffleOptions: true,
            },
          },
        },
      },
    },
  });

  if (!moduleItem) throw new Error('Modul tidak ditemukan');
  if (session.user.role === 'TEACHER' && moduleItem.course.teacherId !== session.user.id) {
    throw new Error('Akses ditolak: Anda bukan pengajar untuk modul ini');
  }
  if (session.user.role === 'ADMIN' && session.user.schoolId && moduleItem.course.schoolId !== session.user.schoolId) {
    throw new Error('Akses ditolak: Modul ini berada di sekolah lain');
  }

  const schoolDefaults = moduleItem.course.school;

  const count = await db.quiz.count({ where: { moduleId: data.moduleId } });

  const resolvedPassingGrade = data.passingGrade !== undefined ? data.passingGrade : (schoolDefaults?.defaultPassingGrade ?? null);
  const resolvedEnableLockdown = data.enableLockdown !== undefined ? Boolean(data.enableLockdown) : (schoolDefaults?.cbtLockdownEnabled ?? true);
  const resolvedMaxTabSwitches = data.maxTabSwitches !== undefined ? Number(data.maxTabSwitches) : (schoolDefaults?.cbtMaxTabSwitches ?? 3);
  const resolvedRequireToken = data.requireToken !== undefined ? Boolean(data.requireToken) : (schoolDefaults?.cbtRequireToken ?? false);
  const resolvedShuffleQuestions = data.shuffleQuestions !== undefined ? Boolean(data.shuffleQuestions) : (schoolDefaults?.cbtShuffleQuestions ?? false);
  const resolvedShuffleOptions = data.shuffleOptions !== undefined ? Boolean(data.shuffleOptions) : (schoolDefaults?.cbtShuffleOptions ?? false);

  const quiz = await db.quiz.create({
    data: {
      moduleId: data.moduleId,
      title: data.title,
      description: data.description || null,
      duration: data.duration ? Number(data.duration) : null,
      deadline: data.deadline ? new Date(data.deadline) : null,
      shuffleQuestions: resolvedShuffleQuestions,
      shuffleOptions: resolvedShuffleOptions,
      questionsPerPage: Number(data.questionsPerPage) || 0,
      isPublished: true,
      order: count,
      maxAttempts: data.maxAttempts ?? null,
      passingGrade: resolvedPassingGrade,
      useQuestionBank: Boolean(data.useQuestionBank),
      requireToken: resolvedRequireToken,
      token: resolvedRequireToken ? (data.token ? data.token.trim().toUpperCase() : null) : null,
      enableLockdown: resolvedEnableLockdown,
      maxTabSwitches: resolvedMaxTabSwitches,
      questionBankSelections: (data.useQuestionBank && data.bankSelections?.length) ? {
        create: data.bankSelections.map(s => ({
          categoryId: s.categoryId,
          count: s.count
        }))
      } : undefined
    },
  });

  // Notify enrolled students
  try {
    const moduleData = await db.module.findUnique({
      where: { id: data.moduleId },
      include: {
        course: {
          include: {
            enrollments: { select: { userId: true } },
          },
        },
      },
    });

    if (moduleData && moduleData.course.enrollments.length > 0) {
      const studentIds = moduleData.course.enrollments.map((e) => e.userId);
      await createBulkNotifications(studentIds, {
        title: `Kuis Baru: ${quiz.title}`,
        message: `Kuis baru telah diterbitkan di ${moduleData.course.title}${quiz.duration ? ` (${quiz.duration} menit)` : ''}${quiz.deadline ? `. Batas pengerjaan: ${new Date(quiz.deadline).toLocaleDateString('id-ID')}` : ''}.`,
        type: 'QUIZ',
        link: `/student/course/${moduleData.course.id}/quiz/${quiz.id}`,
      });
    }
  } catch (err) {
    console.error('Failed to notify students on createQuiz:', err);
  }

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  return quiz;
}

async function assertQuizOwnership(quizId: string) {
  const session = await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      module: {
        include: {
          course: {
            select: { id: true, teacherId: true, schoolId: true },
          },
        },
      },
    },
  });

  if (!quiz) throw new Error('Kuis tidak ditemukan');
  const course = quiz.module.course;
  if (session.user.role === 'TEACHER' && course.teacherId !== session.user.id) {
    throw new Error('Akses ditolak: Anda bukan pengajar untuk kuis ini');
  }
  if (session.user.role === 'ADMIN' && session.user.schoolId && course.schoolId !== session.user.schoolId) {
    throw new Error('Akses ditolak: Kuis ini berada di sekolah lain');
  }

  return { session, quiz, course };
}

async function assertQuizQuestionOwnership(questionId: string) {
  const session = await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');
  const question = await db.quizQuestion.findUnique({
    where: { id: questionId },
    include: {
      quiz: {
        include: {
          module: {
            include: {
              course: {
                select: { id: true, teacherId: true, schoolId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!question) throw new Error('Butir soal tidak ditemukan');
  const course = question.quiz.module.course;
  if (session.user.role === 'TEACHER' && course.teacherId !== session.user.id) {
    throw new Error('Akses ditolak: Anda bukan pengajar untuk soal ini');
  }
  if (session.user.role === 'ADMIN' && session.user.schoolId && course.schoolId !== session.user.schoolId) {
    throw new Error('Akses ditolak: Soal ini berada di sekolah lain');
  }

  return { session, question, course };
}

export async function deleteQuiz(quizId: string) {
  await assertQuizOwnership(quizId);

  // Find all attempt IDs for this quiz to clean up answers first
  const attempts = await db.quizAttempt.findMany({
    where: { quizId },
    select: { id: true },
  });
  const attemptIds = attempts.map((a) => a.id);

  if (attemptIds.length > 0) {
    await db.quizAnswer.deleteMany({
      where: { attemptId: { in: attemptIds } },
    });
  }

  await db.quizAttempt.deleteMany({
    where: { quizId },
  });

  await db.quizBankSelection.deleteMany({
    where: { quizId },
  });

  await db.quizQuestion.deleteMany({
    where: { quizId },
  });

  const deleted = await db.quiz.delete({
    where: { id: quizId },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  return deleted;
}

export async function addQuizQuestion(
  quizId: string,
  data: {
    type: QuestionType;
    text: string;
    points: number;
    options?: { id: string; text: string; isCorrect: boolean }[];
  }
) {
  await assertQuizOwnership(quizId);

  const count = await db.quizQuestion.count({ where: { quizId } });
  await assertFileReferences(data);
  if (!Number.isFinite(data.points) || data.points <= 0) throw new Error('Poin soal harus lebih dari nol');

  const question = await db.quizQuestion.create({
    data: {
      quizId,
      type: data.type,
      text: data.text,
      points: Number(data.points || 1),
      options: data.options ?? undefined,
      order: count,
    },
  });

  revalidatePath(`/teacher/course/[courseId]/quiz/${quizId}`, 'page');
  await bindFileReferences('QUIZ_QUESTION', question.id, question);
  return question;
}

export async function updateQuizQuestion(
  questionId: string,
  data: {
    text?: string;
    type?: QuestionType;
    options?: { id: string; text: string; isCorrect: boolean }[];
    points?: number;
  }
) {
  await assertQuizQuestionOwnership(questionId);
  await assertFileReferences(data);
  if (data.points !== undefined && (!Number.isFinite(data.points) || data.points <= 0)) throw new Error('Poin soal tidak valid');

  const question = await db.quizQuestion.update({
    where: { id: questionId },
    data: {
      text: data.text,
      type: data.type,
      options: data.options ?? undefined,
      points: data.points ? Number(data.points) : undefined,
    },
  });

  await bindFileReferences('QUIZ_QUESTION', question.id, question);
  return question;
}

export async function deleteQuizQuestion(questionId: string) {
  await assertQuizQuestionOwnership(questionId);

  const deleted = await db.quizQuestion.delete({
    where: { id: questionId },
  });

  return deleted;
}

export async function updateQuizSettings(
  quizId: string,
  data: {
    title?: string;
    description?: string;
    duration?: number | null;
    deadline?: string | null;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
    questionsPerPage?: number;
    maxAttempts?: number | null;
    passingGrade?: number | null;
    requireToken?: boolean;
    token?: string | null;
    enableLockdown?: boolean;
    maxTabSwitches?: number;
  }
) {
  await assertQuizOwnership(quizId);

  const quiz = await db.quiz.update({
    where: { id: quizId },
    data: {
      title: data.title,
      description: data.description,
      duration: data.duration !== undefined ? data.duration : undefined,
      deadline: data.deadline !== undefined ? (data.deadline ? new Date(data.deadline) : null) : undefined,
      shuffleQuestions: data.shuffleQuestions,
      shuffleOptions: data.shuffleOptions,
      questionsPerPage: data.questionsPerPage !== undefined ? data.questionsPerPage : undefined,
      maxAttempts: data.maxAttempts !== undefined ? data.maxAttempts : undefined,
      passingGrade: data.passingGrade !== undefined ? data.passingGrade : undefined,
      requireToken: data.requireToken !== undefined ? data.requireToken : undefined,
      token: data.requireToken ? (data.token ? data.token.trim().toUpperCase() : null) : data.requireToken === false ? null : undefined,
      enableLockdown: data.enableLockdown !== undefined ? data.enableLockdown : undefined,
      maxTabSwitches: data.maxTabSwitches !== undefined ? data.maxTabSwitches : undefined,
    },
  });

  return quiz;
}

export async function getQuizWithQuestions(quizId: string) {
  await assertQuizOwnership(quizId);

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
      },
      _count: {
        select: {
          attempts: true,
        },
      },
    },
  });

  return quiz;
}

export async function getQuizStatusForStudent(quizId: string) {
  const { session } = await assertItemAccess('QUIZ', quizId);

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      module: {
        select: { courseId: true },
      },
      attempts: {
        where: { userId: session.user.id, isVoided: false },
        orderBy: { startedAt: 'desc' },
      },
      parentQuiz: {
        select: { id: true, title: true, passingGrade: true }
      }
    },
  });

  if (!quiz) throw new Error('Quiz not found');

  if (session.user.role === 'STUDENT') {
    const hasAccess = await checkStudentItemAccess({
      userId: session.user.id,
      itemType: 'QUIZ',
      itemId: quizId,
      courseId: quiz.module.courseId,
    });
    if (!hasAccess) {
      throw new Error('Anda tidak memiliki akses ke kuis ini.');
    }
  }

  const attempts = quiz.attempts;
  const submittedAttempts = attempts.filter((a) => a.submittedAt !== null);
  const unsubmittedAttempt = attempts.find((a) => a.submittedAt === null);

  const submittedCount = submittedAttempts.length;
  const hasActiveAttempt = !!unsubmittedAttempt;
  
  let bestScore: number | null = null;
  if (submittedCount > 0) {
    const scores = submittedAttempts.filter((attempt) => attempt.isGraded).map((a) => a.score).filter((s) => s !== null) as number[];
    if (scores.length > 0) {
      bestScore = Math.max(...scores);
    }
  }

  let passed: boolean | null = null;
  if (quiz.passingGrade !== null && bestScore !== null) {
    passed = bestScore >= quiz.passingGrade;
  }

  let status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' = 'NOT_STARTED';
  
  if (quiz.deadline && new Date() > new Date(quiz.deadline) && submittedCount === 0 && !hasActiveAttempt) {
    status = 'EXPIRED';
  } else if (submittedCount > 0) {
    status = 'COMPLETED';
  } else if (hasActiveAttempt) {
    status = 'IN_PROGRESS';
  }

  // Check if targeted for remedial
  let isTargeted = true;
  if (quiz.isRemedial && quiz.targetStudentIds) {
    const targetIds = Array.isArray(quiz.targetStudentIds) ? (quiz.targetStudentIds as string[]) : [];
    if (targetIds.length > 0) {
      isTargeted = targetIds.includes(session.user.id);
    }
  }

  return {
    status,
    submittedCount,
    maxAttempts: quiz.maxAttempts,
    bestScore,
    passingGrade: quiz.passingGrade,
    passed,
    latestAttempt: submittedAttempts.length > 0 ? {
      score: submittedAttempts[0].score,
      submittedAt: submittedAttempts[0].submittedAt
    } : null,
    hasActiveAttempt,
    requireToken: quiz.requireToken,
    enableLockdown: quiz.enableLockdown,
    maxTabSwitches: quiz.maxTabSwitches,
    isRemedial: quiz.isRemedial,
    parentQuiz: quiz.parentQuiz,
    isTargeted,
  };
}

export async function startOrGetQuizAttempt(quizId: string, token?: string) {
  return startQuiz(quizId, token);
}

export async function submitQuizAttempt(attemptId: string, answers: { questionId: string; answer: string }[]) {
  return submitQuiz(attemptId, answers);
}
