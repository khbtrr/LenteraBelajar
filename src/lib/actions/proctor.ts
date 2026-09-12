'use server';

import { db } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';

export interface ProctorStudentData {
  userId: string;
  name: string;
  email: string;
  nis: string | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'TERMINATED';
  attemptId: string | null;
  startedAt: Date | null;
  submittedAt: Date | null;
  tabSwitchCount: number;
  extraTimeMinutes: number;
  score: number | null;
  isOnline: boolean;
  lastActiveAt: Date | null;
  remainingSeconds: number | null;
  terminationReason: string | null;
}

export interface LiveProctorData {
  quiz: {
    id: string;
    title: string;
    courseId: string;
    duration: number | null;
    deadline: Date | null;
    requireToken: boolean;
    token: string | null;
    enableLockdown: boolean;
    maxTabSwitches: number;
    questionsCount: number;
  };
  students: ProctorStudentData[];
  stats: {
    total: number;
    notStarted: number;
    inProgress: number;
    submitted: number;
    terminated: number;
    violationsCount: number;
  };
}

export async function verifyQuizToken(quizId: string, token: string) {
  await requireAuth();

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    select: { requireToken: true, token: true },
  });

  if (!quiz) throw new Error('Kuis tidak ditemukan');
  if (!quiz.requireToken) return { valid: true };

  const inputToken = token.trim().toUpperCase();
  const quizToken = (quiz.token || '').trim().toUpperCase();

  return { valid: inputToken === quizToken };
}

export async function recordTabSwitch(attemptId: string) {
  const session = await requireAuth();

  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        include: {
          questions: true,
        },
      },
      answers: true,
    },
  });

  if (!attempt) throw new Error('Attempt tidak ditemukan');
  if (attempt.userId !== session.user.id) throw new Error('Akses ditolak');
  if (attempt.submittedAt !== null) {
    return { tabSwitchCount: attempt.tabSwitchCount, isTerminated: true, message: 'Kuis telah selesai.' };
  }

  const updatedCount = attempt.tabSwitchCount + 1;
  const maxAllowed = attempt.quiz.maxTabSwitches || 3;
  const reachedLimit = attempt.quiz.enableLockdown && updatedCount >= maxAllowed;

  if (reachedLimit) {
    // Auto-terminate / auto-submit attempt
    // Compute score for existing answers
    let totalScore = 0;
    for (const ans of attempt.answers) {
      if (ans.score !== null) totalScore += ans.score;
    }

    await db.quizAttempt.update({
      where: { id: attemptId },
      data: {
        tabSwitchCount: updatedCount,
        isTerminated: true,
        terminationReason: `Melebihi batas toleransi meninggalkan layar ujian (${updatedCount}/${maxAllowed})`,
        submittedAt: new Date(),
        score: totalScore,
        isGraded: true,
      },
    });

    return {
      tabSwitchCount: updatedCount,
      isTerminated: true,
      remainingSwitches: 0,
      message: `Ujian Anda otomatis dihentikan dan dikumpulkan karena berpindah tab sebanyak ${updatedCount} kali.`,
    };
  } else {
    await db.quizAttempt.update({
      where: { id: attemptId },
      data: {
        tabSwitchCount: updatedCount,
        lastActiveAt: new Date(),
      },
    });

    return {
      tabSwitchCount: updatedCount,
      isTerminated: false,
      remainingSwitches: Math.max(0, maxAllowed - updatedCount),
      message: `Peringatan: Anda meninggalkan layar ujian (${updatedCount}/${maxAllowed}). Ujian akan otomatis di-submit jika Anda melanggar lagi!`,
    };
  }
}

export async function pingAttemptHeartbeat(attemptId: string) {
  const session = await requireAuth();

  await db.quizAttempt.updateMany({
    where: { id: attemptId, userId: session.user.id },
    data: { lastActiveAt: new Date() },
  });

  return { success: true };
}

export async function getLiveProctorData(quizId: string): Promise<LiveProctorData> {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      module: {
        select: {
          courseId: true,
          course: {
            include: {
              enrollments: {
                include: {
                  user: {
                    select: { id: true, name: true, email: true, nis: true },
                  },
                },
              },
            },
          },
        },
      },
      attempts: {
        orderBy: { startedAt: 'desc' },
      },
      _count: {
        select: { questions: true },
      },
    },
  });

  if (!quiz) throw new Error('Kuis tidak ditemukan');

  const enrolledStudents = quiz.module.course.enrollments.map((enr) => enr.user);
  const now = new Date();

  const studentDataList: ProctorStudentData[] = enrolledStudents.map((student) => {
    // Find latest attempt of this student
    const studentAttempts = quiz.attempts.filter((a) => a.userId === student.id);
    const latestAttempt = studentAttempts[0] || null;

    let status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'TERMINATED' = 'NOT_STARTED';
    let isOnline = false;
    let remainingSeconds: number | null = null;

    if (latestAttempt) {
      if (latestAttempt.isTerminated) {
        status = 'TERMINATED';
      } else if (latestAttempt.submittedAt !== null) {
        status = 'SUBMITTED';
      } else {
        status = 'IN_PROGRESS';
      }

      // Check online status (active in last 40 seconds)
      const diffMs = now.getTime() - new Date(latestAttempt.lastActiveAt).getTime();
      isOnline = diffMs < 40000 && latestAttempt.submittedAt === null;

      // Compute remaining time if in progress
      if (status === 'IN_PROGRESS' && quiz.duration) {
        const totalMinutes = quiz.duration + (latestAttempt.extraTimeMinutes || 0);
        const elapsedSeconds = Math.floor(
          (now.getTime() - new Date(latestAttempt.startedAt).getTime()) / 1000
        );
        const totalSeconds = totalMinutes * 60;
        remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
      }
    }

    return {
      userId: student.id,
      name: student.name,
      email: student.email,
      nis: student.nis,
      status,
      attemptId: latestAttempt?.id || null,
      startedAt: latestAttempt?.startedAt || null,
      submittedAt: latestAttempt?.submittedAt || null,
      tabSwitchCount: latestAttempt?.tabSwitchCount || 0,
      extraTimeMinutes: latestAttempt?.extraTimeMinutes || 0,
      score: latestAttempt?.score || null,
      isOnline,
      lastActiveAt: latestAttempt?.lastActiveAt || null,
      remainingSeconds,
      terminationReason: latestAttempt?.terminationReason || null,
    };
  });

  const stats = {
    total: studentDataList.length,
    notStarted: studentDataList.filter((s) => s.status === 'NOT_STARTED').length,
    inProgress: studentDataList.filter((s) => s.status === 'IN_PROGRESS').length,
    submitted: studentDataList.filter((s) => s.status === 'SUBMITTED').length,
    terminated: studentDataList.filter((s) => s.status === 'TERMINATED').length,
    violationsCount: studentDataList.reduce((acc, curr) => acc + curr.tabSwitchCount, 0),
  };

  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      courseId: quiz.module.courseId,
      duration: quiz.duration,
      deadline: quiz.deadline,
      requireToken: quiz.requireToken,
      token: quiz.token,
      enableLockdown: quiz.enableLockdown,
      maxTabSwitches: quiz.maxTabSwitches,
      questionsCount: quiz._count.questions,
    },
    students: studentDataList,
    stats,
  };
}

export async function grantExtraTime(attemptId: string, minutes: number) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    select: { extraTimeMinutes: true, quizId: true },
  });

  if (!attempt) throw new Error('Attempt tidak ditemukan');

  const updated = await db.quizAttempt.update({
    where: { id: attemptId },
    data: {
      extraTimeMinutes: attempt.extraTimeMinutes + minutes,
    },
  });

  revalidatePath(`/[locale]/teacher/course/[courseId]/quiz-attempts/${attempt.quizId}/proctor`, 'page');
  return updated;
}

export async function forceSubmitAttempt(attemptId: string, reason?: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: true,
    },
  });

  if (!attempt) throw new Error('Attempt tidak ditemukan');

  let totalScore = 0;
  for (const ans of attempt.answers) {
    if (ans.score !== null) totalScore += ans.score;
  }

  const updated = await db.quizAttempt.update({
    where: { id: attemptId },
    data: {
      submittedAt: new Date(),
      score: totalScore,
      isGraded: true,
      terminationReason: reason || 'Dihentikan dan dikumpulkan secara paksa oleh Pengawas Ujian.',
    },
  });

  revalidatePath(`/[locale]/teacher/course/[courseId]/quiz-attempts/${attempt.quizId}/proctor`, 'page');
  return updated;
}

export async function resetStudentAttempt(attemptId: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    select: { quizId: true },
  });

  if (!attempt) throw new Error('Attempt tidak ditemukan');

  // Delete answers first, then attempt
  await db.quizAnswer.deleteMany({
    where: { attemptId },
  });

  await db.quizAttempt.delete({
    where: { id: attemptId },
  });

  revalidatePath(`/[locale]/teacher/course/[courseId]/quiz-attempts/${attempt.quizId}/proctor`, 'page');
  return { success: true };
}

export async function updateQuizSecuritySettings(
  quizId: string,
  data: {
    requireToken: boolean;
    token?: string;
    enableLockdown: boolean;
    maxTabSwitches: number;
  }
) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const updated = await db.quiz.update({
    where: { id: quizId },
    data: {
      requireToken: data.requireToken,
      token: data.requireToken ? (data.token || null) : null,
      enableLockdown: data.enableLockdown,
      maxTabSwitches: data.maxTabSwitches,
    },
  });

  return updated;
}
