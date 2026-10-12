import 'server-only';
import { db } from '@/lib/db';
import { effectiveQuizScore, normalizeScore } from '@/lib/grading-policy';

export function meanScore(values: Array<number | null>): number | null {
  const graded = values.filter((value): value is number => value !== null);
  return graded.length ? Math.round(graded.reduce((sum, value) => sum + value, 0) / graded.length * 10) / 10 : null;
}

export async function loadCourseGrades(courseId: string, userIds: string[], client = db) {
  const [allQuizzes, assignments, attempts, submissions, extras, enrollments, members, overrides] = await Promise.all([
    client.quiz.findMany({ where: { module: { courseId }, isPublished: true }, include: { cohortAccess: true }, orderBy: { order: 'asc' } }),
    client.assignment.findMany({ where: { module: { courseId }, isPublished: true }, include: { cohortAccess: true }, orderBy: { order: 'asc' } }),
    client.quizAttempt.findMany({ where: { userId: { in: userIds }, quiz: { module: { courseId } }, isGraded: true, isVoided: false, submittedAt: { not: null }, score: { not: null } }, orderBy: { submittedAt: 'desc' } }),
    client.assignmentSubmission.findMany({ where: { userId: { in: userIds }, assignment: { module: { courseId } }, gradedAt: { not: null }, score: { not: null } }, orderBy: { gradedAt: 'desc' } }),
    client.grade.findMany({ where: { courseId, userId: { in: userIds }, type: { in: ['MANUAL', 'ATTENDANCE'] }, includeInAverage: true } }),
    client.enrollment.findMany({ where: { courseId, userId: { in: userIds } }, select: { userId: true, cohortId: true } }),
    client.cohortMember.findMany({ where: { userId: { in: userIds } }, select: { userId: true, cohortId: true } }),
    client.itemAccessOverride.findMany({ where: { userId: { in: userIds } }, select: { userId: true, itemType: true, itemId: true } }),
  ]);
  const quizzes = allQuizzes.filter((quiz) => !quiz.isRemedial);
  const scores = new Map<string, { quiz: Record<string, number | null>; assignment: Record<string, number | null>; average: number | null }>();
  for (const userId of userIds) {
    const cohortIds = new Set(members.filter((member) => member.userId === userId).map((member) => member.cohortId));
    const enrollment = enrollments.find((item) => item.userId === userId);
    if (enrollment?.cohortId) cohortIds.add(enrollment.cohortId);
    const granted = new Set(overrides.filter((override) => override.userId === userId).map((override) => `${override.itemType}:${override.itemId}`));
    const allowed = (item: { id: string; cohortAccess: { cohortId: string }[] }, type: string) => Boolean(enrollment)
      && (!item.cohortAccess.length || granted.has(`${type}:${item.id}`) || item.cohortAccess.some((grant) => cohortIds.has(grant.cohortId)));
    const quizScores: Record<string, number | null> = {};
    const assignmentScores: Record<string, number | null> = {};
    const normalized: Array<number | null> = [];
    for (const quiz of quizzes) {
      const originals = attempts.filter((attempt) => attempt.userId === userId && attempt.quizId === quiz.id).map((attempt) => attempt.score!);
      const remedialIds = new Set(allQuizzes.filter((child) => child.isRemedial && child.parentQuizId === quiz.id).map((child) => child.id));
      const remedials = attempts.filter((attempt) => attempt.userId === userId && remedialIds.has(attempt.quizId)).map((attempt) => attempt.score!);
      quizScores[quiz.id] = allowed(quiz, 'QUIZ') ? effectiveQuizScore(originals.length ? Math.max(...originals) : null, remedials.length ? Math.max(...remedials) : null, quiz.passingGrade ?? 75) : null;
      normalized.push(quizScores[quiz.id]);
    }
    for (const assignment of assignments) {
      const submission = submissions.find((item) => item.userId === userId && item.assignmentId === assignment.id);
      const score = allowed(assignment, 'ASSIGNMENT') && submission ? submission.score : null;
      assignmentScores[assignment.id] = score;
      normalized.push(score === null ? null : normalizeScore(score, assignment.maxScore));
    }
    normalized.push(...extras.filter((grade) => grade.userId === userId).map((grade) => normalizeScore(grade.score, grade.maxScore)));
    scores.set(userId, { quiz: quizScores, assignment: assignmentScores, average: meanScore(normalized) });
  }
  return { quizzes, assignments, scores, attempts, submissions };
}
