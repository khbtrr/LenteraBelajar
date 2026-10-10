import 'server-only';
import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { effectiveQuizScore } from '@/lib/grading-policy';

export async function syncQuizGrade(tx: Prisma.TransactionClient, quizId: string, userId: string) {
  const quiz = await tx.quiz.findUniqueOrThrow({ where: { id: quizId }, include: { parentQuiz: true, module: true } });
  const rootId = quiz.isRemedial && quiz.parentQuizId ? quiz.parentQuizId : quiz.id;
  const root = quiz.isRemedial && quiz.parentQuiz ? quiz.parentQuiz : quiz;
  const courseId = quiz.module.courseId;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`grade:${courseId}:${userId}`}, 0)) IS NULL AS locked`;
  const attempts = await tx.quizAttempt.findMany({
    where: { userId, isGraded: true, isVoided: false, submittedAt: { not: null }, score: { not: null }, quiz: { OR: [{ id: rootId }, { parentQuizId: rootId, isRemedial: true }] } },
    include: { quiz: { select: { isRemedial: true } } },
  });
  const originals = attempts.filter((attempt) => !attempt.quiz.isRemedial).map((attempt) => attempt.score!);
  const remedials = attempts.filter((attempt) => attempt.quiz.isRemedial).map((attempt) => attempt.score!);
  const score = effectiveQuizScore(originals.length ? Math.max(...originals) : null, remedials.length ? Math.max(...remedials) : null, root.passingGrade ?? 75);
  const resourceKey = `QUIZ:${rootId}`;
  if (score === null) {
    await tx.grade.updateMany({ where: { courseId, userId, resourceKey }, data: { includeInAverage: false } });
    return;
  }
  await tx.grade.upsert({
    where: { courseId_userId_resourceKey: { courseId, userId, resourceKey } },
    create: { courseId, userId, resourceKey, sourceId: rootId, type: 'QUIZ', label: root.title, score, maxScore: 100, includeInAverage: true },
    update: { score, maxScore: 100, label: root.title, includeInAverage: true },
  });
}

export async function refreshQuizGrade(quizId: string, userId: string) {
  return db.$transaction((tx) => syncQuizGrade(tx, quizId, userId));
}
