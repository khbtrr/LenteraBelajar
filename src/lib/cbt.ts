import 'server-only';
import { randomInt } from 'node:crypto';
import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth-utils';
import { assertItemAccess } from '@/lib/access';
import { gradeAnswers, readSnapshot, type AnswerInput, type SnapshotQuestion } from '@/lib/grading-policy';
import { syncQuizGrade } from '@/lib/grade-projection';
import { awardXpInTransaction } from '@/lib/rewards';
import { fileNamesIn } from '@/lib/files';

const attemptInclude = { answers: true, quiz: { include: { module: true } } } satisfies Prisma.QuizAttemptInclude;
type LoadedAttempt = Prisma.QuizAttemptGetPayload<{ include: typeof attemptInclude }>;

export function attemptEndAt(attempt: { startedAt: Date; extraTimeMinutes: number; quiz: { duration: number | null; deadline: Date | null } }): Date | null {
  const durationEnd = attempt.quiz.duration === null ? null : attempt.startedAt.getTime() + (attempt.quiz.duration + attempt.extraTimeMinutes) * 60_000;
  const hardEnd = attempt.quiz.deadline?.getTime() ?? null;
  const time = durationEnd === null ? hardEnd : hardEnd === null ? durationEnd : Math.min(durationEnd, hardEnd);
  return time === null ? null : new Date(time);
}

async function participantLock(tx: Prisma.TransactionClient, quizId: string, userId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`quiz:${quizId}:${userId}`}, 0)) IS NULL AS locked`;
}

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function validateAnswers(questions: SnapshotQuestion[], answers: unknown): AnswerInput[] {
  if (!Array.isArray(answers) || answers.length > questions.length) throw new Error('Jawaban kuis tidak valid');
  const allowed = new Set(questions.map((question) => question.id));
  const seen = new Set<string>();
  for (const answer of answers) {
    if (!answer || typeof answer.questionId !== 'string' || typeof answer.answer !== 'string'
      || answer.answer.length > 100_000 || !allowed.has(answer.questionId) || seen.has(answer.questionId)) {
      throw new Error('Jawaban bukan bagian snapshot kuis atau tidak valid');
    }
    seen.add(answer.questionId);
  }
  return answers;
}

function finalResult(attempt: { score: number | null; isGraded: boolean; isTerminated: boolean; submittedAt: Date | null }, alreadySubmitted = false) {
  return { success: true, score: attempt.score, isGraded: attempt.isGraded, isTerminated: attempt.isTerminated, submittedAt: attempt.submittedAt, alreadySubmitted };
}

async function finalizeLocked(tx: Prisma.TransactionClient, attempt: LoadedAttempt, answers: unknown, reason: 'SUBMIT' | 'TIMEOUT' | 'PROCTOR', terminationReason?: string) {
  if (attempt.submittedAt) return finalResult(attempt, true);
  const questions = readSnapshot(attempt.questionSnapshot);
  const expired = (attemptEndAt(attempt)?.getTime() ?? Infinity) <= Date.now();
  const incoming = reason === 'SUBMIT' && !expired ? validateAnswers(questions, answers) : [];
  const merged = new Map(attempt.answers.map((answer) => [answer.questionId, answer.answer ?? '']));
  for (const answer of incoming) merged.set(answer.questionId, answer.answer);
  const graded = gradeAnswers(questions, [...merged].map(([questionId, answer]) => ({ questionId, answer })));
  await tx.quizAnswer.deleteMany({ where: { attemptId: attempt.id } });
  await tx.quizAnswer.createMany({ data: graded.answers.map((answer) => ({ ...answer, attemptId: attempt.id })) });
  const final = await tx.quizAttempt.update({ where: { id: attempt.id, submittedAt: null }, data: {
    submittedAt: new Date(), score: graded.score, isGraded: graded.isGraded,
    isTerminated: reason === 'PROCTOR',
    terminationReason: reason === 'PROCTOR' ? terminationReason ?? 'Dihentikan pengawas' : expired ? 'Waktu ujian berakhir' : null,
  } });
  if (graded.isGraded) {
    await syncQuizGrade(tx, attempt.quizId, attempt.userId);
    if (graded.score !== null && graded.score >= (attempt.quiz.passingGrade ?? 75)) {
      await awardXpInTransaction(tx, {
        userId: attempt.userId, amount: graded.score === 100 ? 100 : 50,
        eventKey: `QUIZ:${attempt.userId}:${attempt.quizId}`, reason: `Menyelesaikan kuis: ${attempt.quiz.title}`,
        actionType: 'QUIZ', courseId: attempt.quiz.module.courseId,
      });
    }
  }
  return { ...finalResult(final), answersRejected: expired && Array.isArray(answers) && answers.length > 0 };
}

export async function startQuiz(quizId: string, token?: string) {
  const { session } = await assertItemAccess('QUIZ', quizId);
  if (session.user.role !== 'STUDENT') throw new Error('Akses ditolak: Hanya siswa dapat memulai pengerjaan');
  return db.$transaction(async (tx) => {
    await participantLock(tx, quizId, session.user.id);
    const quiz = await tx.quiz.findUniqueOrThrow({ where: { id: quizId }, include: { questions: { orderBy: { order: 'asc' } }, questionBankSelections: true } });
    let attempt = await tx.quizAttempt.findFirst({ where: { quizId, userId: session.user.id, submittedAt: null, isVoided: false }, include: attemptInclude });
    if (attempt && (attemptEndAt(attempt)?.getTime() ?? Infinity) <= Date.now()) {
      await finalizeLocked(tx, attempt, [], 'TIMEOUT');
      attempt = null;
    }
    const submittedCount = await tx.quizAttempt.count({ where: { quizId, userId: session.user.id, submittedAt: { not: null }, isVoided: false } });
    if (!attempt) {
      if (!quiz.isPublished || (quiz.deadline && quiz.deadline.getTime() <= Date.now())) throw new Error('Kuis belum diterbitkan atau batas waktu telah berakhir');
      if (quiz.maxAttempts !== null && submittedCount >= quiz.maxAttempts) throw new Error('Batas kesempatan kuis telah habis');
      if (quiz.requireToken && (!quiz.token || !token || token.trim().toUpperCase() !== quiz.token.trim().toUpperCase())) throw new Error('Token akses ujian tidak sesuai');
      let source: unknown[] = quiz.questions;
      if (quiz.useQuestionBank) {
        source = [];
        const courseModule = await tx.module.findUniqueOrThrow({ where: { id: quiz.moduleId }, select: { courseId: true } });
        for (const selection of quiz.questionBankSelections) {
          const pool = await tx.questionBank.findMany({ where: { courseId: courseModule.courseId, categoryId: selection.categoryId } });
          if (selection.count < 1 || pool.length < selection.count) throw new Error('Bank soal tidak memiliki cukup soal');
          source.push(...shuffle(pool).slice(0, selection.count));
        }
      }
      let snapshot = readSnapshot(source);
      if (quiz.shuffleQuestions) snapshot = shuffle(snapshot);
      if (quiz.shuffleOptions) snapshot = snapshot.map((question) => ({ ...question, options: question.options ? shuffle(question.options) : null }));
      attempt = await tx.quizAttempt.create({ data: { quizId, userId: session.user.id, questionSnapshot: snapshot as unknown as Prisma.InputJsonValue }, include: attemptInclude });
      const names = fileNamesIn(snapshot);
      if (names.length) {
        const assets = await tx.fileAsset.findMany({ where: { filename: { in: names }, state: 'ATTACHED' }, select: { id: true } });
        await tx.fileBinding.createMany({ data: assets.map((asset) => ({ assetId: asset.id, resourceType: 'ATTEMPT', resourceId: attempt!.id })), skipDuplicates: true });
      }
    }
    const questions = readSnapshot(attempt.questionSnapshot).map(({ _correctData, ...question }) => question);
    const { quiz: privateQuiz, ...safeAttempt } = attempt;
    return {
      attempt: { ...safeAttempt, questionSnapshot: null }, questions, quizTitle: quiz.title,
      durationMinutes: quiz.duration, endAt: attemptEndAt(attempt)?.toISOString() ?? null, serverNow: new Date().toISOString(),
      maxAttempts: quiz.maxAttempts, submittedCount, passingGrade: quiz.passingGrade,
      questionsPerPage: quiz.questionsPerPage, shuffleOptions: quiz.shuffleOptions,
      enableLockdown: quiz.enableLockdown, maxTabSwitches: quiz.maxTabSwitches,
    };
  }, { timeout: 30000, maxWait: 10000 });
}

async function withAttempt<T>(attemptId: string, run: (tx: Prisma.TransactionClient, attempt: LoadedAttempt) => Promise<T>) {
  const identity = await db.quizAttempt.findUnique({ where: { id: attemptId }, select: { quizId: true, userId: true } });
  if (!identity) throw new Error('Data pengerjaan tidak ditemukan');
  return db.$transaction(async (tx) => {
    await participantLock(tx, identity.quizId, identity.userId);
    const attempt = await tx.quizAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: attemptInclude });
    return run(tx, attempt);
  }, { timeout: 30000, maxWait: 10000 });
}

export async function submitQuiz(attemptId: string, answers: AnswerInput[]) {
  const session = await requireAuth();
  return withAttempt(attemptId, async (tx, attempt) => {
    if (attempt.userId !== session.user.id) throw new Error('Akses ditolak');
    if (attempt.isVoided) throw new Error('Pengerjaan telah direset pengajar');
    return finalizeLocked(tx, attempt, answers, 'SUBMIT');
  });
}

export async function saveQuizDraft(attemptId: string, answers: AnswerInput[]) {
  const session = await requireAuth();
  return withAttempt(attemptId, async (tx, attempt) => {
    if (attempt.userId !== session.user.id) throw new Error('Akses ditolak');
    if (attempt.isVoided) throw new Error('Pengerjaan telah direset pengajar');
    if (attempt.submittedAt) throw new Error('Kuis sudah dikumpulkan');
    if ((attemptEndAt(attempt)?.getTime() ?? Infinity) <= Date.now()) {
      const result = await finalizeLocked(tx, attempt, [], 'TIMEOUT');
      return { ...result, expired: true };
    }
    const valid = validateAnswers(readSnapshot(attempt.questionSnapshot), answers);
    for (const answer of valid) await tx.quizAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: answer.questionId } },
      create: { attemptId, questionId: answer.questionId, answer: answer.answer }, update: { answer: answer.answer },
    });
    return { success: true, expired: false, savedAt: new Date().toISOString() };
  });
}

export async function finalizeSystemAttempt(attemptId: string, reason: 'TIMEOUT' | 'PROCTOR', message?: string) {
  return withAttempt(attemptId, async (tx, attempt) => {
    if (reason === 'TIMEOUT' && (attemptEndAt(attempt)?.getTime() ?? Infinity) > Date.now()) throw new Error('Waktu ujian belum berakhir');
    return finalizeLocked(tx, attempt, [], reason, message);
  });
}

export async function heartbeatQuiz(attemptId: string) {
  const session = await requireAuth();
  return withAttempt(attemptId, async (tx, attempt) => {
    if (attempt.userId !== session.user.id) throw new Error('Akses ditolak');
    if (!attempt.submittedAt && (attemptEndAt(attempt)?.getTime() ?? Infinity) <= Date.now()) {
      await finalizeLocked(tx, attempt, [], 'TIMEOUT');
    } else if (!attempt.submittedAt) {
      await tx.quizAttempt.update({ where: { id: attemptId }, data: { lastActiveAt: new Date() } });
    }
    const latest = await tx.quizAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: attemptInclude });
    return { ...finalResult(latest), endAt: attemptEndAt(latest)?.toISOString() ?? null, serverNow: new Date().toISOString() };
  });
}

export async function gradeEssay(answerId: string, score: number, teacherNote?: string) {
  const answer = await db.quizAnswer.findUniqueOrThrow({ where: { id: answerId }, select: { attemptId: true, attempt: { select: { quizId: true } } } });
  await assertItemAccess('QUIZ', answer.attempt.quizId, 'manage');
  return withAttempt(answer.attemptId, async (tx, attempt) => {
    if (!attempt.submittedAt) throw new Error('Kuis belum dikumpulkan');
    const current = await tx.quizAnswer.findUniqueOrThrow({ where: { id: answerId } });
    const questions = readSnapshot(attempt.questionSnapshot);
    const question = questions.find((item) => item.id === current.questionId);
    if (!question || question.type !== 'ESSAY' || !Number.isFinite(score) || score < 0 || score > question.points) throw new Error('Nilai essay di luar poin soal');
    await tx.quizAnswer.update({ where: { id: answerId }, data: { score, teacherNote } });
    const gradedAnswers = await tx.quizAnswer.findMany({ where: { attemptId: attempt.id } });
    const isGraded = gradedAnswers.length === questions.length && gradedAnswers.every((item) => item.score !== null);
    const percentage = isGraded ? gradedAnswers.reduce((sum, item) => sum + item.score!, 0) / questions.reduce((sum, item) => sum + item.points, 0) * 100 : null;
    await tx.quizAttempt.update({ where: { id: attempt.id }, data: { score: percentage, isGraded } });
    if (isGraded) await syncQuizGrade(tx, attempt.quizId, attempt.userId);
    return { success: true, score: percentage, isGraded };
  });
}

export async function recordQuizViolation(attemptId: string) {
  const session = await requireAuth();
  return withAttempt(attemptId, async (tx, attempt) => {
    if (attempt.userId !== session.user.id) throw new Error('Akses ditolak');
    if (attempt.submittedAt || attempt.isVoided) return { tabSwitchCount: attempt.tabSwitchCount, isTerminated: true, message: 'Kuis telah selesai' };
    const count = attempt.tabSwitchCount + 1;
    await tx.quizAttempt.update({ where: { id: attempt.id }, data: { tabSwitchCount: count, lastActiveAt: new Date() } });
    const isTerminated = attempt.quiz.enableLockdown && count >= attempt.quiz.maxTabSwitches;
    if (isTerminated) await finalizeLocked(tx, attempt, [], 'PROCTOR', `Melebihi toleransi pindah tab (${count}/${attempt.quiz.maxTabSwitches})`);
    return { tabSwitchCount: count, isTerminated, remainingSwitches: Math.max(0, attempt.quiz.maxTabSwitches - count), message: isTerminated ? 'Ujian dihentikan dan draft server dikumpulkan' : 'Pelanggaran berpindah tab dicatat' };
  });
}

export async function extendQuizTime(attemptId: string, minutes: number) {
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 240) throw new Error('Tambahan waktu harus 1 sampai 240 menit');
  return withAttempt(attemptId, async (tx, attempt) => {
    if (attempt.submittedAt || attempt.isVoided || (attemptEndAt(attempt)?.getTime() ?? Infinity) <= Date.now()) throw new Error('Ujian telah berakhir');
    return tx.quizAttempt.update({ where: { id: attemptId }, data: { extraTimeMinutes: { increment: minutes } } });
  });
}

export async function voidQuizAttempt(attemptId: string) {
  return withAttempt(attemptId, async (tx, attempt) => {
    await tx.quizAttempt.update({ where: { id: attemptId }, data: { isVoided: true, submittedAt: attempt.submittedAt ?? new Date(), terminationReason: 'Direset pengajar; riwayat dipertahankan' } });
    await syncQuizGrade(tx, attempt.quizId, attempt.userId);
    return { success: true };
  });
}
