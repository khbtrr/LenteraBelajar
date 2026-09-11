'use server';

import { db } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/auth-utils';
import { QuestionType, GradeType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

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
}) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const count = await db.quiz.count({ where: { moduleId: data.moduleId } });

  const quiz = await db.quiz.create({
    data: {
      moduleId: data.moduleId,
      title: data.title,
      description: data.description || null,
      duration: data.duration ? Number(data.duration) : null,
      deadline: data.deadline ? new Date(data.deadline) : null,
      shuffleQuestions: Boolean(data.shuffleQuestions),
      shuffleOptions: Boolean(data.shuffleOptions),
      questionsPerPage: Number(data.questionsPerPage) || 0,
      isPublished: true,
      order: count,
      maxAttempts: data.maxAttempts ?? null,
      passingGrade: data.passingGrade ?? null,
      useQuestionBank: Boolean(data.useQuestionBank),
      questionBankSelections: (data.useQuestionBank && data.bankSelections?.length) ? {
        create: data.bankSelections.map(s => ({
          categoryId: s.categoryId,
          count: s.count
        }))
      } : undefined
    },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  return quiz;
}

export async function deleteQuiz(quizId: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

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
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

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
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

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
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

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
  }
) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

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
    },
  });

  return quiz;
}

export async function getQuizWithQuestions(quizId: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

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
      attempts: {
        where: { userId: session.user.id },
        orderBy: { startedAt: 'desc' },
      },
    },
  });

  if (!quiz) throw new Error('Quiz not found');

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
  };
}

export async function startOrGetQuizAttempt(quizId: string) {
  const session = await requireAuth();

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
      },
      questionBankSelections: true,
    },
  });

  if (!quiz) throw new Error('Quiz not found');

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

  let questions: any[] = [];

  if (attempt) {
    if (quiz.useQuestionBank && attempt.questionSnapshot) {
      const snapshot: any = attempt.questionSnapshot;
      questions = snapshot.map((q: any) => ({
         id: q.id,
         type: q.type,
         text: q.text,
         points: q.points,
         options: q.options
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
    let snapshotToSave: any = null;

    if (quiz.useQuestionBank) {
      let bankQuestions: any[] = [];
      for (const selection of quiz.questionBankSelections || []) {
         const qbQuestions = await db.questionBank.findMany({
           where: { categoryId: selection.categoryId },
         });
         const shuffled = qbQuestions.sort(() => Math.random() - 0.5).slice(0, selection.count);
         bankQuestions.push(...shuffled);
      }
      
      const snapshot = bankQuestions.map(q => {
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
           _correctData: correctData
         };
      });
      snapshotToSave = snapshot;
      questions = snapshot.map(q => ({
         id: q.id,
         type: q.type,
         text: q.text,
         points: q.points,
         options: q.options
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

    attempt = await db.quizAttempt.create({
      data: {
        quizId,
        userId: session.user.id,
        startedAt: new Date(),
        questionSnapshot: snapshotToSave
      },
      include: {
        answers: true,
      },
    });
  }

  // Shuffle questions if quiz.shuffleQuestions is true
  if (quiz.shuffleQuestions) {
    questions = [...questions].sort(() => Math.random() - 0.5);
  }

  // Shuffle options if quiz.shuffleOptions is true
  if (quiz.shuffleOptions) {
    questions = questions.map((q) => {
      if (q.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(q.options)) {
        return {
          ...q,
          options: [...q.options].sort(() => Math.random() - 0.5),
        };
      }
      return q;
    });
  }

  return {
    attempt,
    quizTitle: quiz.title,
    durationMinutes: quiz.duration,
    questions,
    maxAttempts: quiz.maxAttempts,
    submittedCount,
    passingGrade: quiz.passingGrade,
    questionsPerPage: quiz.questionsPerPage ?? 0,
    shuffleOptions: quiz.shuffleOptions ?? false,
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
        },
      },
    },
  });

  if (!attempt) throw new Error('Attempt not found');
  if (attempt.submittedAt) throw new Error('Kuis sudah pernah dikumpulkan');

  let totalScore = 0;
  let totalPoints = 0;
  let hasEssay = false;

  let activeQuestions: any[] = [];
  
  if (attempt.quiz.useQuestionBank && attempt.questionSnapshot) {
     activeQuestions = attempt.questionSnapshot as any[];
  } else {
     activeQuestions = attempt.quiz.questions;
  }

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
    } else {
      // Essay question requires manual teacher grading
      hasEssay = true;
      questionScore = null;
    }

    await db.quizAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: q.id,
        answer: answerText,
        score: questionScore,
      },
    });
  }

  // Calculate final score scaled to 100
  const finalPercentage = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
  const isFullyGraded = !hasEssay;
  const currentAttemptScore = isFullyGraded ? Math.round(finalPercentage * 10) / 10 : null;

  await db.quizAttempt.update({
    where: { id: attemptId },
    data: {
      submittedAt: new Date(),
      score: currentAttemptScore,
      isGraded: isFullyGraded,
    },
  });

  // Record into Grade table if fully graded
  if (isFullyGraded) {
    // Find all submitted attempts for this user and quiz to get the best score
    const allAttempts = await db.quizAttempt.findMany({
      where: {
        quizId: attempt.quizId,
        userId: session.user.id,
        submittedAt: { not: null },
        score: { not: null }
      }
    });
    
    const bestScore = Math.max(...allAttempts.map(a => a.score as number), currentAttemptScore as number);

    const existingGrade = await db.grade.findFirst({
       where: {
          userId: session.user.id,
          courseId: attempt.quiz.module.courseId,
          type: GradeType.QUIZ,
          label: attempt.quiz.title
       }
    });

    if (existingGrade) {
       await db.grade.update({
         where: { id: existingGrade.id },
         data: { score: bestScore, sourceId: attempt.id }
       });
    } else {
       await db.grade.create({
         data: {
           courseId: attempt.quiz.module.courseId,
           userId: session.user.id,
           label: attempt.quiz.title,
           score: bestScore,
           maxScore: 100,
           type: GradeType.QUIZ,
           sourceId: attempt.id,
         },
       });
    }
  }

  revalidatePath('/[locale]/student/course/[courseId]/quiz/[quizId]', 'page');
  return {
    success: true,
    score: currentAttemptScore,
    isGraded: isFullyGraded,
  };
}
