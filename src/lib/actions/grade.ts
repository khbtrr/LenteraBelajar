'use server';

import { getServerSession as auth } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { createNotification } from '@/lib/notifications';
import { assertCourseAccess, assertItemAccess } from '@/lib/access';
import { gradeEssay } from '@/lib/cbt';
import { loadCourseGrades, meanScore } from '@/lib/course-grades';

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
  modules?: Array<{
    id: string;
    title: string;
    quizzes: Array<{ id: string; title: string }>;
    assignments: Array<{ id: string; title: string; maxScore: number }>;
  }>;
  quizzes: Array<{ id: string; title: string }>;
  assignments: Array<{ id: string; title: string; maxScore: number }>;
  students: StudentGradeItem[];
  classAverage: number | null;
  highestScore: number | null;
  lowestScore: number | null;
}

export async function getCourseGradebook(courseId: string): Promise<CourseGradebookData | null> {
  await assertCourseAccess(courseId, 'roster');
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: { academicYear: true, category: true, modules: { select: { id: true, title: true } },
      enrollments: { include: { user: { select: { id: true, name: true, email: true, nis: true } } }, orderBy: { user: { name: 'asc' } } } },
  });
  if (!course) return null;
  const grades = await loadCourseGrades(courseId, course.enrollments.map((enrollment) => enrollment.userId));
  const students = course.enrollments.map(({ user }) => ({
    ...user, quizScores: grades.scores.get(user.id)!.quiz,
    assignmentScores: grades.scores.get(user.id)!.assignment, average: grades.scores.get(user.id)!.average,
  }));
  const averages = students.map((student) => student.average).filter((value): value is number => value !== null);
  return {
    course: { id: course.id, title: course.title, academicYear: { name: course.academicYear.name }, category: course.category },
    modules: course.modules.map((module) => ({ ...module,
      quizzes: grades.quizzes.filter((quiz) => quiz.moduleId === module.id).map(({ id, title }) => ({ id, title })),
      assignments: grades.assignments.filter((assignment) => assignment.moduleId === module.id).map(({ id, title, maxScore }) => ({ id, title, maxScore })),
    })),
    quizzes: grades.quizzes.map(({ id, title }) => ({ id, title })),
    assignments: grades.assignments.map(({ id, title, maxScore }) => ({ id, title, maxScore })),
    students, classAverage: meanScore(averages),
    highestScore: averages.length ? Math.max(...averages) : null,
    lowestScore: averages.length ? Math.min(...averages) : null,
  };
}

export async function getAssignmentSubmissionsList(assignmentId: string) {
  const access = await assertItemAccess('ASSIGNMENT', assignmentId);
  if (access.session.user.role === 'STUDENT') throw new Error('Akses ditolak');
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      cohortAccess: { select: { cohortId: true } },
      module: {
        include: {
          course: {
            include: {
              enrollments: {
                include: {
                  cohort: { select: { id: true } },
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

  const allowedCohortIds = (assignment.cohortAccess || []).map((ca) => ca.cohortId);

  let allowedStudentIdSet: Set<string> | null = null;
  if (allowedCohortIds.length > 0) {
    const [overrides, cohortMembers] = await Promise.all([
      db.itemAccessOverride.findMany({
        where: { itemType: 'ASSIGNMENT', itemId: assignmentId },
        select: { userId: true },
      }),
      db.cohortMember.findMany({
        where: { cohortId: { in: allowedCohortIds } },
        select: { userId: true },
      }),
    ]);

    allowedStudentIdSet = new Set<string>();
    for (const o of overrides) allowedStudentIdSet.add(o.userId);
    for (const cm of cohortMembers) allowedStudentIdSet.add(cm.userId);
  }

  const submissionsByUser = new Map(assignment.submissions.map((s) => [s.userId, s]));

  const eligibleEnrollments = assignment.module.course.enrollments.filter((e) => {
    if (allowedCohortIds.length === 0) return true;
    if (e.cohort?.id && allowedCohortIds.includes(e.cohort.id)) return true;
    if (allowedStudentIdSet && allowedStudentIdSet.has(e.user.id)) return true;
    return false;
  });

  const enrolledStudents = eligibleEnrollments.map((e) => {
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

  if (!['TEACHER', 'ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    throw new Error('Akses ditolak: Hanya pengajar atau administrator yang dapat menilai tugas.');
  }

  const submission = await db.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
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

  if (!submission) throw new Error('Submission not found');

  const course = submission.assignment.module.course;
  if (session.user.role === 'TEACHER' && course.teacherId !== session.user.id) {
    throw new Error('Akses ditolak: Anda bukan pengajar untuk mata pelajaran ini.');
  }
  if (session.user.role === 'ADMIN' && session.user.schoolId && course.schoolId !== session.user.schoolId) {
    throw new Error('Akses ditolak: Mata pelajaran ini tidak berada dalam sekolah Anda.');
  }

  const rawScore = Number(data.score);
  const maxScore = submission.assignment.maxScore || 100;
  if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > maxScore) throw new Error('Nilai di luar skala tugas');
  const validatedScore = rawScore;

  const updated = await db.$transaction(async (tx) => {
  const updated = await tx.assignmentSubmission.update({
    where: { id: submissionId },
    data: {
      score: validatedScore,
      teacherNote: data.teacherNote,
      gradedAt: new Date(),
    },
  });

  // Upsert to Grade table
  await tx.grade.upsert({
    where: {
      courseId_userId_resourceKey: { courseId: submission.assignment.module.courseId, userId: submission.userId, resourceKey: `ASSIGNMENT:${submission.assignmentId}` },
    },
    update: {
      score: validatedScore,
      maxScore: submission.assignment.maxScore,
    },
    create: {
      courseId: submission.assignment.module.courseId,
      userId: submission.userId,
      label: submission.assignment.title,
      score: validatedScore,
      resourceKey: `ASSIGNMENT:${submission.assignmentId}`,
      includeInAverage: true,
      maxScore: submission.assignment.maxScore,
      type: 'ASSIGNMENT',
      sourceId: submission.assignmentId,
    },
  });
  return updated;
  });

  // Notify student
  try {
    await createNotification({
      userId: submission.userId,
      title: `Nilai Tugas Keluar: ${submission.assignment.title}`,
      message: `Guru telah memberikan nilai: ${data.score}/${submission.assignment.maxScore}${data.teacherNote ? `. Catatan: "${data.teacherNote}"` : ''}`,
      type: 'GRADE',
      link: `/student/course/${submission.assignment.module.courseId}/assignment/${submission.assignment.id}`,
    });
  } catch (err) {
    console.error('Failed to notify student on gradeAssignmentSubmission:', err);
  }

  revalidatePath(`/teacher/course/${submission.assignment.module.courseId}/submissions/${submission.assignmentId}`);
  revalidatePath(`/teacher/course/${submission.assignment.module.courseId}/gradebook`);
  return updated;
}

export async function getQuizAttemptsList(quizId: string) {
  const access = await assertItemAccess('QUIZ', quizId);
  if (access.session.user.role === 'STUDENT') throw new Error('Akses ditolak');
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
        where: { submittedAt: { not: null }, isVoided: false },
        include: {
          user: {
            select: { id: true, name: true, email: true, nis: true },
          },
          answers: true,
        },
        orderBy: { submittedAt: 'desc' },
      },
    },
  });

  if (!quiz) return null;

  if (session.user.role === 'STUDENT') {
    throw new Error('Akses ditolak: Siswa tidak diizinkan mengakses daftar pengerjaan kuis.');
  }

  const course = quiz.module.course;
  if (session.user.role === 'TEACHER' && course.teacherId !== session.user.id) {
    throw new Error('Akses ditolak: Anda bukan pengajar untuk kuis ini.');
  }
  if (session.user.role === 'ADMIN' && session.user.schoolId && course.schoolId !== session.user.schoolId) {
    throw new Error('Akses ditolak: Kuis ini tidak berada dalam sekolah Anda.');
  }

  // Build a base question lookup map
  const questionMap = new Map<string, { id: string; type: string; text: string; points: number }>();
  for (const q of quiz.questions) {
    questionMap.set(q.id, { id: q.id, type: q.type, text: q.text, points: q.points });
  }

  const attemptsWithQuestions = quiz.attempts.map((att) => {
    // If bank soal snapshot exists, merge its questions into local lookup
    const localMap = new Map(questionMap);
    if (att.questionSnapshot && Array.isArray(att.questionSnapshot)) {
      for (const sq of att.questionSnapshot as any[]) {
        if (sq?.id) {
          localMap.set(sq.id, { id: sq.id, type: sq.type, text: sq.text, points: sq.points || 1 });
        }
      }
    }

    const answersWithQuestion = att.answers.map((ans) => {
      const qInfo = localMap.get(ans.questionId) || {
        id: ans.questionId,
        type: 'MULTIPLE_CHOICE',
        text: 'Soal Ujian',
        points: 1,
      };
      return {
        ...ans,
        question: qInfo,
      };
    });

    return {
      ...att,
      answers: answersWithQuestion,
    };
  });

  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      courseId: quiz.module.courseId,
      courseTitle: quiz.module.course.title,
      passingGrade: quiz.passingGrade,
      maxAttempts: quiz.maxAttempts,
    },
    questions: quiz.questions,
    attempts: attemptsWithQuestions,
  };
}

export async function gradeQuizEssayAnswer(answerId: string, data: { score: number; teacherNote?: string }) {
  const result = await gradeEssay(answerId, Number(data.score), data.teacherNote);
  revalidatePath('/[locale]/teacher/course/[courseId]/quiz-attempts/[quizId]', 'page');
  return result;
}

export async function getStudentGradesOverview(userId: string) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
  if (session.user.role === 'STUDENT' && session.user.id !== userId) throw new Error('Akses ditolak');
  const enrollments = await db.enrollment.findMany({
    where: { userId }, include: { course: { include: { teacher: { select: { name: true } }, academicYear: true } } },
  });
  const results = [];
  for (const enrollment of enrollments) {
    try { await assertCourseAccess(enrollment.courseId); } catch { continue; }
    const { course } = enrollment;
    const grades = await loadCourseGrades(course.id, [userId]);
    const values = grades.scores.get(userId)!;
    results.push({
      courseId: course.id, courseTitle: course.title, teacherName: course.teacher.name,
      academicYear: course.academicYear.name, average: values.average,
      quizzes: grades.quizzes.map((quiz) => {
        const latest = grades.attempts.find((attempt) => attempt.userId === userId && attempt.quizId === quiz.id);
        return { id: quiz.id, title: quiz.title, score: values.quiz[quiz.id], isGraded: values.quiz[quiz.id] !== null, submittedAt: latest?.submittedAt ?? null };
      }),
      assignments: grades.assignments.map((assignment) => {
        const latest = grades.submissions.find((submission) => submission.userId === userId && submission.assignmentId === assignment.id);
        return { id: assignment.id, title: assignment.title, maxScore: assignment.maxScore,
          score: values.assignment[assignment.id], teacherNote: latest?.teacherNote ?? null,
          submittedAt: latest?.submittedAt ?? null, gradedAt: latest?.gradedAt ?? null };
      }),
    });
  }
  return results;
}
