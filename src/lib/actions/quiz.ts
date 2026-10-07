'use server';

import { db } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/auth-utils';
import { QuestionType, GradeType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { createBulkNotifications } from './notification';
import { awardXp } from './gamification';
import { checkStudentItemAccess } from './cohort-access';

export async function getQuizById(quizId: string) {
  const session = await requireAuth();

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

  const question = await db.quizQuestion.update({
    where: { id: questionId },
    data: {
      text: data.text,
      type: data.type,
      options: data.options ?? undefined,
      points: data.points ? Number(data.points) : undefined,
    },
  });

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
  const session = await requireAuth();

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      module: {
        select: { courseId: true },
      },
      attempts: {
        where: { userId: session.user.id },
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
    const scores = submittedAttempts.map((a) => a.score).filter((s) => s !== null) as number[];
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
  const session = await requireAuth();

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      module: {
        select: { courseId: true },
      },
      questions: {
        orderBy: { order: 'asc' },
      },
      questionBankSelections: true,
    },
  });

  if (!quiz) throw new Error('Quiz not found');

  // Check cohort access restriction
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

  // Check remedial eligibility
  if (quiz.isRemedial && quiz.targetStudentIds) {
    const targetIds = Array.isArray(quiz.targetStudentIds) ? (quiz.targetStudentIds as string[]) : [];
    if (targetIds.length > 0 && !targetIds.includes(session.user.id)) {
      throw new Error('Anda tidak terdaftar sebagai peserta kuis remedial ini.');
    }
  }

  // Check deadline
  if (quiz.deadline && new Date() > new Date(quiz.deadline)) {
    throw new Error('Batas waktu pengerjaan kuis telah berakhir');
  }

  const submittedCount = await db.quizAttempt.count({
    where: {
      quizId,
      userId: session.user.id,
      submittedAt: { not: null }
    }
  });

  if (quiz.maxAttempts !== null && submittedCount >= quiz.maxAttempts) {
    throw new Error(`Batas kesempatan mengerjakan kuis telah habis (${submittedCount}/${quiz.maxAttempts})`);
  }

  // Find active attempt (submittedAt is null)
  let attempt = await db.quizAttempt.findFirst({
    where: {
      quizId,
      userId: session.user.id,
      submittedAt: null,
    },
    include: {
      answers: true,
    },
  });

  // Verify token if required and starting a new attempt
  if (quiz.requireToken && !attempt) {
    const inputToken = (token || '').trim().toUpperCase();
    const correctToken = (quiz.token || '').trim().toUpperCase();
    if (!inputToken || inputToken !== correctToken) {
      throw new Error('Token akses ujian tidak sesuai atau belum dimasukkan');
    }
  }

  let questions: any[] = [];

  if (attempt) {
    if (attempt.questionSnapshot && Array.isArray(attempt.questionSnapshot)) {
      const snapshot: any[] = attempt.questionSnapshot as any[];
      questions = snapshot.map((q: any) => ({
        id: q.id,
        type: q.type,
        text: q.text,
        points: q.points,
        options: q.options,
      }));
    } else {
      questions = quiz.questions.map((q) => {
        let sanitizedOptions = null;
        if (q.options && Array.isArray(q.options)) {
          sanitizedOptions = (q.options as any[]).map((opt) => ({
            id: opt.id,
            text: opt.text,
          }));
        }
        return {
          id: q.id,
          type: q.type,
          text: q.text,
          points: q.points,
          options: sanitizedOptions,
        };
      });
    }
  } else {
    let preparedQuestions: any[] = [];

    if (quiz.useQuestionBank) {
      const bankQuestions: any[] = [];
      for (const selection of quiz.questionBankSelections || []) {
        const qbQuestions = await db.questionBank.findMany({
          where: { categoryId: selection.categoryId },
        });
        const shuffled = qbQuestions.sort(() => Math.random() - 0.5).slice(0, selection.count);
        bankQuestions.push(...shuffled);
      }

      preparedQuestions = bankQuestions.map((q) => {
        let sanitizedOptions = null;
        let correctData = null;
        if (q.options && Array.isArray(q.options)) {
          sanitizedOptions = (q.options as any[]).map((opt) => ({
            id: opt.id,
            text: opt.text,
          }));
          correctData = q.options;
        }
        return {
          id: q.id,
          type: q.type,
          text: q.text,
          points: q.points,
          options: sanitizedOptions,
          _correctData: correctData,
        };
      });
    } else {
      preparedQuestions = quiz.questions.map((q) => {
        let sanitizedOptions = null;
        let correctData = null;
        if (q.options && Array.isArray(q.options)) {
          sanitizedOptions = (q.options as any[]).map((opt) => ({
            id: opt.id,
            text: opt.text,
          }));
          correctData = q.options;
        }
        return {
          id: q.id,
          type: q.type,
          text: q.text,
          points: q.points,
          options: sanitizedOptions,
          _correctData: correctData,
        };
      });
    }

    // Shuffle questions once on attempt creation if enabled
    if (quiz.shuffleQuestions) {
      preparedQuestions = [...preparedQuestions].sort(() => Math.random() - 0.5);
    }

    // Shuffle options once on attempt creation if enabled
    if (quiz.shuffleOptions) {
      preparedQuestions = preparedQuestions.map((q) => {
        if (
          (q.type === QuestionType.MULTIPLE_CHOICE || q.type === QuestionType.MULTIPLE_CHOICE_COMPLEX) &&
          Array.isArray(q.options)
        ) {
          const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
          return {
            ...q,
            options: shuffledOptions,
          };
        }
        return q;
      });
    }

    attempt = await db.quizAttempt.create({
      data: {
        quizId,
        userId: session.user.id,
        startedAt: new Date(),
        questionSnapshot: preparedQuestions,
      },
      include: {
        answers: true,
      },
    });

    questions = preparedQuestions.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      points: q.points,
      options: q.options,
    }));
  }

  const effectiveDuration = quiz.duration
    ? quiz.duration + (attempt?.extraTimeMinutes || 0)
    : null;

  // Sanitize attempt to prevent leaking server-side snapshot with correct answers
  const safeAttempt = attempt
    ? {
        ...attempt,
        questionSnapshot: null,
      }
    : null;

  return {
    attempt: safeAttempt,
    quizTitle: quiz.title,
    durationMinutes: effectiveDuration,
    questions,
    maxAttempts: quiz.maxAttempts,
    submittedCount,
    passingGrade: quiz.passingGrade,
    questionsPerPage: quiz.questionsPerPage ?? 0,
    shuffleOptions: quiz.shuffleOptions ?? false,
    enableLockdown: quiz.enableLockdown,
    maxTabSwitches: quiz.maxTabSwitches,
    requireToken: quiz.requireToken,
  };
}

export async function submitQuizAttempt(
  attemptId: string,
  answers: { questionId: string; answer: string }[]
) {
  const session = await requireAuth();

  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId, userId: session.user.id },
    include: {
      quiz: {
        include: {
          questions: true,
          module: true,
          parentQuiz: true,
        },
      },
    },
  });

  if (!attempt) throw new Error('Attempt not found');
  if (attempt.submittedAt) {
    return {
      success: true,
      score: attempt.score,
      isGraded: attempt.isGraded,
    };
  }

  let totalScore = 0;
  let totalPoints = 0;
  let hasEssay = false;

  let activeQuestions: any[] = [];
  
  if (attempt.quiz.useQuestionBank && attempt.questionSnapshot) {
     activeQuestions = attempt.questionSnapshot as any[];
  } else {
     activeQuestions = attempt.quiz.questions;
  }

  const answersToInsert: Array<{
    attemptId: string;
    questionId: string;
    answer: string;
    score: number | null;
  }> = [];

  for (const q of activeQuestions) {
    totalPoints += q.points;
    const studentAns = answers.find((a) => a.questionId === q.id);
    const answerText = studentAns?.answer || '';

    let questionScore: number | null = null;

    if (q.type === QuestionType.MULTIPLE_CHOICE) {
      let options = [];
      if (attempt.quiz.useQuestionBank && attempt.questionSnapshot) {
         options = q._correctData || [];
      } else {
         options = (q.options as any[]) || [];
      }
      
      const correctOption = options.find((opt: any) => opt.isCorrect);
      // Check if student's chosen option ID matches the correct option ID
      if (correctOption && studentAns && studentAns.answer === correctOption.id) {
        questionScore = q.points;
        totalScore += q.points;
      } else {
        questionScore = 0;
      }
    } else if (q.type === QuestionType.MULTIPLE_CHOICE_COMPLEX) {
      let options = [];
      if (attempt.quiz.useQuestionBank && attempt.questionSnapshot) {
        options = q._correctData || [];
      } else {
        options = (q.options as any[]) || [];
      }

      let studentSelectedIds: string[] = [];
      if (studentAns?.answer) {
        const trimmed = studentAns.answer.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            studentSelectedIds = (JSON.parse(trimmed) as string[]).map((s) => String(s).trim().toUpperCase());
          } catch {
            studentSelectedIds = trimmed.replace(/[\[\]"]/g, '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
          }
        } else {
          studentSelectedIds = trimmed.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
        }
      }
      studentSelectedIds.sort();

      const correctOptions = options.filter((opt: any) => opt.isCorrect);
      const correctOptionIds = correctOptions.map((opt: any) => String(opt.id).trim().toUpperCase()).sort();

      const isAllCorrect =
        correctOptionIds.length > 0 &&
        studentSelectedIds.length === correctOptionIds.length &&
        studentSelectedIds.every((val, index) => val === correctOptionIds[index]);

      if (isAllCorrect) {
        questionScore = q.points;
        totalScore += q.points;
      } else {
        questionScore = 0;
      }
    } else {
      // Essay question requires manual teacher grading
      hasEssay = true;
      questionScore = null;
    }

    answersToInsert.push({
      attemptId: attempt.id,
      questionId: q.id,
      answer: answerText,
      score: questionScore,
    });
  }

  // Calculate final score scaled to 100
  const finalPercentage = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
  const isFullyGraded = !hasEssay;
  const currentAttemptScore = isFullyGraded ? Math.round(finalPercentage * 10) / 10 : null;

  await db.$transaction(async (tx) => {
    // Delete partial answers if re-submitting before inserting new answers
    await tx.quizAnswer.deleteMany({
      where: { attemptId: attempt.id },
    });

    if (answersToInsert.length > 0) {
      await tx.quizAnswer.createMany({
        data: answersToInsert,
      });
    }

    await tx.quizAttempt.update({
      where: { id: attemptId },
      data: {
        submittedAt: new Date(),
        score: currentAttemptScore,
        isGraded: isFullyGraded,
      },
    });
  });

  // Record into Grade table if fully graded
  if (isFullyGraded) {
    const isRemedial = attempt.quiz.isRemedial && !!attempt.quiz.parentQuiz;
    const targetQuizTitle = isRemedial ? attempt.quiz.parentQuiz!.title : attempt.quiz.title;
    const passingLimit = isRemedial && attempt.quiz.parentQuiz?.passingGrade 
      ? attempt.quiz.parentQuiz.passingGrade 
      : 100;

    // Find all submitted attempts for this user and quiz to get the best score
    const allAttempts = await db.quizAttempt.findMany({
      where: {
        quizId: attempt.quizId,
        userId: session.user.id,
        submittedAt: { not: null },
        score: { not: null }
      }
    });
    
    let bestScore = Math.max(...allAttempts.map(a => a.score as number), currentAttemptScore as number);
    if (isRemedial) {
      bestScore = Math.min(bestScore, passingLimit);
    }

    const existingGrade = await db.grade.findFirst({
       where: {
          userId: session.user.id,
          courseId: attempt.quiz.module.courseId,
          type: GradeType.QUIZ,
          label: targetQuizTitle
       }
    });

    if (existingGrade) {
       const finalScore = isRemedial ? Math.max(existingGrade.score, bestScore) : bestScore;
       await db.grade.update({
         where: { id: existingGrade.id },
         data: { score: finalScore, sourceId: attempt.id }
       });
    } else {
       await db.grade.create({
         data: {
           courseId: attempt.quiz.module.courseId,
           userId: session.user.id,
           label: targetQuizTitle,
           score: bestScore,
           maxScore: 100,
           type: GradeType.QUIZ,
           sourceId: attempt.id,
         },
       });
    }

    // Gamification XP Award
    try {
      const passingGrade = attempt.quiz.passingGrade ?? 75;
      if (currentAttemptScore !== null && currentAttemptScore >= passingGrade) {
        let earnedXp = 50;
        let reason = `Menyelesaikan kuis: ${attempt.quiz.title} (Lulus KKM)`;
        if (currentAttemptScore === 100) {
          earnedXp += 50; // Bonus perfect score (+100 XP total)
          reason = `Nilai sempurna (100) kuis: ${attempt.quiz.title}`;
        }
        await awardXp(
          session.user.id,
          earnedXp,
          reason,
          'QUIZ',
          attempt.quiz.module.courseId
        );
      }
    } catch (xpErr) {
      console.error('Failed to award XP for quiz attempt:', xpErr);
    }
  }

  revalidatePath('/[locale]/student/course/[courseId]/quiz/[quizId]', 'page');
  return {
    success: true,
    score: currentAttemptScore,
    isGraded: isFullyGraded,
  };
}
