'use server';

import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-utils';
import { AcademicYearStatus, CourseStatus, Role } from '@prisma/client';

export async function getAdminDashboardData() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) {
    throw new Error('Sekolah tidak ditemukan');
  }

  // 1. Fetch School & Active Academic Year
  const [school, activeAcademicYear] = await Promise.all([
    db.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        code: true,
        logo: true,
        defaultPassingGrade: true,
      },
    }),
    db.academicYear.findFirst({
      where: { schoolId, status: AcademicYearStatus.ACTIVE },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    }),
  ]);

  const passingThreshold = school?.defaultPassingGrade ?? 75;

  // 2. Fetch User Analytics in Parallel
  const [
    totalUsers,
    studentCount,
    teacherCount,
    staffCount,
    activeUserCount,
    totalCourses,
    activeCourses,
    archivedCourses,
    totalCohorts,
    totalModules,
    totalQuizzes,
    pendingRequests,
    pendingCount,
    completedAttempts,
  ] = await Promise.all([
    db.user.count({ where: { schoolId } }),
    db.user.count({ where: { schoolId, role: Role.STUDENT } }),
    db.user.count({ where: { schoolId, role: Role.TEACHER } }),
    db.user.count({ where: { schoolId, role: { in: [Role.ADMIN, Role.SUPERVISOR] } } }),
    db.user.count({ where: { schoolId, isActive: true } }),

    // Courses & Cohorts
    db.course.count({ where: { schoolId } }),
    db.course.count({ where: { schoolId, status: CourseStatus.ACTIVE } }),
    db.course.count({ where: { schoolId, status: CourseStatus.ARCHIVED } }),
    db.cohort.count({ where: { schoolId } }),
    db.module.count({ where: { course: { schoolId } } }),

    // CBT & Quizzes
    db.quiz.count({ where: { module: { course: { schoolId } } } }),

    // Pending Course Requests (with details)
    db.courseRequest.findMany({
      where: { schoolId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    db.courseRequest.count({ where: { schoolId, status: 'PENDING' } }),

    // CBT Attempts (for pass-rate calculation)
    db.quizAttempt.findMany({
      where: {
        quiz: { module: { course: { schoolId } } },
        submittedAt: { not: null },
      },
      select: {
        id: true,
        score: true,
        submittedAt: true,
        user: { select: { name: true } },
        quiz: { select: { title: true, passingGrade: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 100, // sample up to 100 recent completed attempts
    }),
  ]);

  // Compute CBT Metrics
  let totalScoreSum = 0;
  let passedAttemptsCount = 0;
  const attemptsWithScore = completedAttempts.filter((a) => a.score !== null);

  for (const a of attemptsWithScore) {
    const scoreVal = a.score!;
    totalScoreSum += scoreVal;
    const requiredGrade = a.quiz?.passingGrade ?? passingThreshold;
    if (scoreVal >= requiredGrade) {
      passedAttemptsCount++;
    }
  }

  const averageScore =
    attemptsWithScore.length > 0
      ? Math.round((totalScoreSum / attemptsWithScore.length) * 10) / 10
      : 0;

  const passingRate =
    attemptsWithScore.length > 0
      ? Math.round((passedAttemptsCount / attemptsWithScore.length) * 100)
      : 0;

  // Student to Teacher Ratio
  const studentTeacherRatio =
    teacherCount > 0 ? Math.round((studentCount / teacherCount) * 10) / 10 : studentCount;

  return {
    school,
    activeAcademicYear,
    users: {
      total: totalUsers,
      students: studentCount,
      teachers: teacherCount,
      staff: staffCount,
      active: activeUserCount,
      inactive: totalUsers - activeUserCount,
      studentTeacherRatio,
    },
    academics: {
      totalCourses,
      activeCourses,
      archivedCourses,
      totalCohorts,
      totalModules,
    },
    cbt: {
      totalQuizzes,
      totalAttempts: attemptsWithScore.length,
      averageScore,
      passingRate,
      passingThreshold,
      recentAttempts: completedAttempts.slice(0, 5),
    },
    pendingRequests: {
      items: pendingRequests,
      total: pendingCount,
    },
  };
}
