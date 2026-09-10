'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export interface StudentGradeItem {
  id: string;
  name: string;
  nis: string | null;
  email: string;
  quizScores: Record<string, number | null>; // quizId -> score
  assignmentScores: Record<string, number | null>; // assignmentId -> score
  average: number | null;
}

export interface CourseGradebookData {
  course: {
    id: string;
    title: string;
    academicYear: { name: string };
    category: { name: string } | null;
  };
  quizzes: Array<{ id: string; title: string }>;
  assignments: Array<{ id: string; title: string; maxScore: number }>;
  students: StudentGradeItem[];
  classAverage: number | null;
  highestScore: number | null;
  lowestScore: number | null;
}

export async function getCourseGradebook(courseId: string): Promise<CourseGradebookData | null> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      academicYear: true,
      category: true,
      modules: {
        include: {
          quizzes: {
            select: { id: true, title: true, order: true },
          },
          assignments: {
            select: { id: true, title: true, maxScore: true, order: true },
          },
        },
      },
      enrollments: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              nis: true,
            },
          },
        },
        orderBy: {
          user: { name: 'asc' },
        },
      },
    },
  });

  if (!course) return null;

  // Flatten quizzes & assignments
  const quizzes = course.modules
    .flatMap((m) => m.quizzes)
    .sort((a, b) => a.order - b.order);

  const assignments = course.modules
    .flatMap((m) => m.assignments)
    .sort((a, b) => a.order - b.order);

  const quizIds = quizzes.map((q) => q.id);
  const assignmentIds = assignments.map((a) => a.id);
  const studentIds = course.enrollments.map((e) => e.user.id);

  // Fetch all quiz attempts and assignment submissions in bulk
  const [quizAttempts, submissions] = await Promise.all([
    quizIds.length > 0 && studentIds.length > 0
      ? db.quizAttempt.findMany({
          where: {
            quizId: { in: quizIds },
            userId: { in: studentIds },
            submittedAt: { not: null },
          },
          orderBy: { startedAt: 'desc' },
        })
      : [],
    assignmentIds.length > 0 && studentIds.length > 0
      ? db.assignmentSubmission.findMany({
          where: {
            assignmentId: { in: assignmentIds },
            userId: { in: studentIds },
          },
        })
      : [],
  ]);

  // Map quiz scores: userId -> quizId -> best score
  const quizMap: Record<string, Record<string, number>> = {};
  for (const attempt of quizAttempts) {
    if (attempt.score !== null) {
      if (!quizMap[attempt.userId]) quizMap[attempt.userId] = {};
      const current = quizMap[attempt.userId][attempt.quizId];
      if (current === undefined || attempt.score > current) {
        quizMap[attempt.userId][attempt.quizId] = attempt.score;
      }
    }
  }

  // Map assignment scores: userId -> assignmentId -> score
  const assignMap: Record<string, Record<string, number>> = {};
  for (const sub of submissions) {
    if (sub.score !== null) {
      if (!assignMap[sub.userId]) assignMap[sub.userId] = {};
      assignMap[sub.userId][sub.assignmentId] = sub.score;
    }
  }

  const allAverages: number[] = [];

  const students: StudentGradeItem[] = course.enrollments.map((e) => {
    const u = e.user;
    const studentQuizScores: Record<string, number | null> = {};
    const studentAssignScores: Record<string, number | null> = {};

    let totalScore = 0;
    let totalItems = 0;

    for (const q of quizzes) {
      const s = quizMap[u.id]?.[q.id] ?? null;
      studentQuizScores[q.id] = s;
      if (s !== null) {
        totalScore += s;
        totalItems++;
      }
    }

    for (const a of assignments) {
      const s = assignMap[u.id]?.[a.id] ?? null;
      studentAssignScores[a.id] = s;
      if (s !== null) {
        totalScore += s;
        totalItems++;
      }
    }

    const avg = totalItems > 0 ? Math.round((totalScore / totalItems) * 10) / 10 : null;
    if (avg !== null) allAverages.push(avg);

    return {
      id: u.id,
      name: u.name,
      nis: u.nis,
      email: u.email,
      quizScores: studentQuizScores,
      assignmentScores: studentAssignScores,
      average: avg,
    };
  });

  const classAverage =
    allAverages.length > 0
      ? Math.round((allAverages.reduce((a, b) => a + b, 0) / allAverages.length) * 10) / 10
      : null;
  const highestScore = allAverages.length > 0 ? Math.max(...allAverages) : null;
  const lowestScore = allAverages.length > 0 ? Math.min(...allAverages) : null;

  return {
    course: {
      id: course.id,
      title: course.title,
      academicYear: { name: course.academicYear.name },
      category: course.category ? { name: course.category.name } : null,
    },
    quizzes,
    assignments,
    students,
    classAverage,
    highestScore,
    lowestScore,
  };
}

export async function getAssignmentSubmissionsList(assignmentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      module: {
        include: {
          course: {
            include: {
              enrollments: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      nis: true,
                    },
                  },
                },
                orderBy: {
                  user: { name: 'asc' },
                },
              },
            },
          },
        },
      },
      submissions: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              nis: true,
            },
          },
        },
      },
    },
  });

  if (!assignment) return null;

  const submissionsByUser = new Map(assignment.submissions.map((s) => [s.userId, s]));

  const enrolledStudents = assignment.module.course.enrollments.map((e) => {
    const sub = submissionsByUser.get(e.user.id);
    return {
      student: e.user,
      submission: sub
        ? {
            id: sub.id,
            fileName: sub.fileName,
            fileUrl: sub.fileUrl,
            fileSize: sub.fileSize,
            submittedAt: sub.submittedAt,
            score: sub.score,
            teacherNote: sub.teacherNote,
            gradedAt: sub.gradedAt,
          }
        : null,
    };
  });

  return {
    assignment: {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      deadline: assignment.deadline,
      maxScore: assignment.maxScore,
      courseId: assignment.module.courseId,
      courseTitle: assignment.module.course.title,
    },
    enrolledStudents,
  };
}

export async function gradeAssignmentSubmission(
  submissionId: string,
  data: { score: number; teacherNote?: string }
) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const submission = await db.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
        include: {
          module: true,
        },
      },
    },
  });

  if (!submission) throw new Error('Submission not found');

  const updated = await db.assignmentSubmission.update({
    where: { id: submissionId },
    data: {
      score: data.score,
      teacherNote: data.teacherNote,
      gradedAt: new Date(),
    },
  });

  // Upsert to Grade table
  await db.grade.upsert({
    where: {
      id: `grade-assign-${submissionId}`,
    },
    update: {
      score: data.score,
      maxScore: submission.assignment.maxScore,
    },
    create: {
      id: `grade-assign-${submissionId}`,
      courseId: submission.assignment.module.courseId,
      userId: submission.userId,
      label: submission.assignment.title,
      score: data.score,
      maxScore: submission.assignment.maxScore,
      type: 'ASSIGNMENT',
      sourceId: submission.assignmentId,
    },
  });

  revalidatePath(`/teacher/course/${submission.assignment.module.courseId}/submissions/${submission.assignmentId}`);
  revalidatePath(`/teacher/course/${submission.assignment.module.courseId}/gradebook`);
  return updated;
}

export async function getQuizAttemptsList(quizId: string) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
      },
      module: {
        include: {
          course: true,
        },
      },
      attempts: {
        where: { submittedAt: { not: null } },
        include: {
          user: {
            select: { id: true, name: true, email: true, nis: true },
          },
          answers: {
            include: {
              question: true,
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
      },
    },
  });

  if (!quiz) return null;

  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      courseId: quiz.module.courseId,
      courseTitle: quiz.module.course.title,
    },
    questions: quiz.questions,
    attempts: quiz.attempts,
  };
}

export async function gradeQuizEssayAnswer(
  answerId: string,
  data: { score: number; teacherNote?: string }
) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const answer = await db.quizAnswer.findUnique({
    where: { id: answerId },
    include: {
      attempt: {
        include: {
          answers: true,
          quiz: {
            include: {
              questions: true,
              module: true,
            },
          },
        },
      },
    },
  });

  if (!answer) throw new Error('Answer not found');

  await db.quizAnswer.update({
    where: { id: answerId },
    data: {
      score: data.score,
      teacherNote: data.teacherNote,
    },
  });

  // Recalculate total score for attempt
  const updatedAnswers = await db.quizAnswer.findMany({
    where: { attemptId: answer.attemptId },
  });

  const totalPoints = answer.attempt.quiz.questions.reduce((acc, q) => acc + q.points, 0);
  const earnedPoints = updatedAnswers.reduce((acc, a) => acc + (a.score || 0), 0);
  const finalPercentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

  // Check if all essay questions have scores
  const allGraded = updatedAnswers.every((a) => a.score !== null);

  await db.quizAttempt.update({
    where: { id: answer.attemptId },
    data: {
      score: finalPercentage,
      isGraded: allGraded,
    },
  });

  // Upsert to Grade table
  await db.grade.upsert({
    where: {
      id: `grade-quiz-${answer.attemptId}`,
    },
    update: {
      score: finalPercentage,
    },
    create: {
      id: `grade-quiz-${answer.attemptId}`,
      courseId: answer.attempt.quiz.module.courseId,
      userId: answer.attempt.userId,
      label: answer.attempt.quiz.title,
      score: finalPercentage,
      maxScore: 100,
      type: 'QUIZ',
      sourceId: answer.attempt.quizId,
    },
  });

  revalidatePath(`/teacher/course/${answer.attempt.quiz.module.courseId}/quiz-attempts/${answer.attempt.quizId}`);
  revalidatePath(`/teacher/course/${answer.attempt.quiz.module.courseId}/gradebook`);
  return { success: true, score: finalPercentage };
}

export async function getStudentGradesOverview(userId: string) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const enrollments = await db.enrollment.findMany({
    where: { userId },
    include: {
      course: {
        include: {
          teacher: { select: { name: true } },
          academicYear: true,
          modules: {
            include: {
              quizzes: {
                include: {
                  attempts: {
                    where: { userId, submittedAt: { not: null } },
                    orderBy: { startedAt: 'desc' },
                    take: 1,
                  },
                },
              },
              assignments: {
                include: {
                  submissions: {
                    where: { userId },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return enrollments.map((e) => {
    const c = e.course;
    const quizzes = c.modules.flatMap((m) =>
      m.quizzes.map((q) => {
        const attempt = q.attempts[0];
        return {
          id: q.id,
          title: q.title,
          score: attempt ? attempt.score : null,
          isGraded: attempt ? attempt.isGraded : false,
          submittedAt: attempt ? attempt.submittedAt : null,
        };
      })
    );

    const assignments = c.modules.flatMap((m) =>
      m.assignments.map((a) => {
        const sub = a.submissions[0];
        return {
          id: a.id,
          title: a.title,
          maxScore: a.maxScore,
          score: sub ? sub.score : null,
          teacherNote: sub ? sub.teacherNote : null,
          submittedAt: sub ? sub.submittedAt : null,
          gradedAt: sub ? sub.gradedAt : null,
        };
      })
    );

    // Calculate course average
    const allScores: number[] = [];
    quizzes.forEach((q) => {
      if (q.score !== null) allScores.push(q.score);
    });
    assignments.forEach((a) => {
      if (a.score !== null) allScores.push(a.score);
    });

    const average =
      allScores.length > 0
        ? Math.round((allScores.reduce((acc, s) => acc + s, 0) / allScores.length) * 10) / 10
        : null;

    return {
      courseId: c.id,
      courseTitle: c.title,
      teacherName: c.teacher.name,
      academicYear: c.academicYear.name,
      average,
      quizzes,
      assignments,
    };
  });
}
