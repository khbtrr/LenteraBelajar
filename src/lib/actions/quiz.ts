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
      isPublished: true,
      order: count,
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

export async function deleteQuizQuestion(questionId: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const deleted = await db.quizQuestion.delete({
    where: { id: questionId },
  });

  return deleted;
}

export async function startOrGetQuizAttempt(quizId: string) {
  const session = await requireAuth();

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!quiz) throw new Error('Quiz not found');

  // Check deadline
  if (quiz.deadline && new Date() > new Date(quiz.deadline)) {
    throw new Error('Batas waktu pengerjaan kuis telah berakhir');
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

  if (!attempt) {
    attempt = await db.quizAttempt.create({
      data: {
        quizId,
        userId: session.user.id,
        startedAt: new Date(),
      },
      include: {
        answers: true,
      },
    });
  }

  // Prepare questions for student: strip `isCorrect` flag to prevent cheating!
  let questions = quiz.questions.map((q) => {
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

  // Shuffle questions if quiz.shuffleQuestions is true
  if (quiz.shuffleQuestions) {
    questions = [...questions].sort(() => Math.random() - 0.5);
  }

  return {
    attempt,
    quizTitle: quiz.title,
    durationMinutes: quiz.duration,
    questions,
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

  for (const q of attempt.quiz.questions) {
    totalPoints += q.points;
    const studentAns = answers.find((a) => a.questionId === q.id);
    const answerText = studentAns?.answer || '';

    let questionScore: number | null = null;

    if (q.type === QuestionType.MULTIPLE_CHOICE) {
      const options = (q.options as any[]) || [];
      const correctOption = options.find((opt) => opt.isCorrect);
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

  const updatedAttempt = await db.quizAttempt.update({
    where: { id: attemptId },
    data: {
      submittedAt: new Date(),
      score: isFullyGraded ? Math.round(finalPercentage * 10) / 10 : null,
      isGraded: isFullyGraded,
    },
  });

  // Record into Grade table if fully graded
  if (isFullyGraded) {
    await db.grade.create({
      data: {
        courseId: attempt.quiz.module.courseId,
        userId: session.user.id,
        label: attempt.quiz.title,
        score: Math.round(finalPercentage * 10) / 10,
        maxScore: 100,
        type: GradeType.QUIZ,
        sourceId: attempt.id,
      },
    });
  }

  revalidatePath('/[locale]/student/course/[courseId]/quiz/[quizId]', 'page');
  return {
    success: true,
    score: isFullyGraded ? Math.round(finalPercentage * 10) / 10 : null,
    isGraded: isFullyGraded,
  };
}
