'use server';

import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-utils';
import { AcademicYearStatus, AttendanceStatus } from '@prisma/client';

export interface SupervisorDashboardStats {
  school: {
    id: string;
    name: string;
    logo: string | null;
    defaultPassingGrade: number;
  };
  academicYear: {
    id: string;
    name: string;
  } | null;
  counts: {
    teachers: number;
    students: number;
    courses: number;
    activeCourses: number;
    modules: number;
  };
  cbtAnalytics: {
    totalQuizzes: number;
    completedAttempts: number;
    averageScore: number;
    passingRate: number;
    passingThreshold: number;
    passedCount: number;
  };
  attendanceAnalytics: {
    totalRecords: number;
    present: number;
    sick: number;
    permission: number;
    absent: number;
    attendanceRate: number;
  };
  topCourses: Array<{
    id: string;
    title: string;
    teacherName: string;
    category: string;
    modulesCount: number;
    studentsCount: number;
    avgScore: number | null;
  }>;
}

export async function getSupervisorDashboardData(): Promise<SupervisorDashboardStats> {
  const session = await requireRole('SUPERVISOR', 'ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('Sekolah tidak ditemukan');

  const [school, activeAcademicYear] = await Promise.all([
    db.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        logo: true,
        defaultPassingGrade: true,
      },
    }),
    db.academicYear.findFirst({
      where: { schoolId, status: AcademicYearStatus.ACTIVE },
      select: { id: true, name: true },
    }),
  ]);

  const passingThreshold = school?.defaultPassingGrade ?? 75;

  const [
    teacherCount,
    studentCount,
    courseCount,
    activeCourseCount,
    moduleCount,
    totalQuizzes,
    recentAttempts,
    attendanceCounts,
    coursesWithGrades,
  ] = await Promise.all([
    db.user.count({ where: { schoolId, role: 'TEACHER', isActive: true } }),
    db.user.count({ where: { schoolId, role: 'STUDENT', isActive: true } }),
    db.course.count({ where: { schoolId } }),
    db.course.count({ where: { schoolId, status: 'ACTIVE' } }),
    db.module.count({ where: { course: { schoolId } } }),
    db.quiz.count({ where: { module: { course: { schoolId } } } }),

    // CBT Attempts for evaluation analytics
    db.quizAttempt.findMany({
      where: {
        quiz: { module: { course: { schoolId } } },
        submittedAt: { not: null },
      },
      select: {
        score: true,
        quiz: { select: { passingGrade: true } },
      },
      take: 200,
      orderBy: { submittedAt: 'desc' },
    }),

    // Attendance stats
    db.attendanceRecord.groupBy({
      by: ['status'],
      where: {
        session: { course: { schoolId } },
      },
      _count: { status: true },
    }),

    // Top Active Courses
    db.course.findMany({
      where: { schoolId, status: 'ACTIVE' },
      take: 6,
      orderBy: { modules: { _count: 'desc' } },
      select: {
        id: true,
        title: true,
        teacher: { select: { name: true } },
        category: { select: { name: true } },
        _count: {
          select: {
            modules: true,
            enrollments: true,
          },
        },
        grades: {
          select: { score: true },
        },
      },
    }),
  ]);

  // CBT Analytics Calculations
  const scoredAttempts = recentAttempts.filter((a) => a.score !== null);
  let totalScoreSum = 0;
  let passedCount = 0;

  for (const a of scoredAttempts) {
    const score = a.score!;
    totalScoreSum += score;
    const requiredGrade = a.quiz?.passingGrade ?? passingThreshold;
    if (score >= requiredGrade) {
      passedCount++;
    }
  }

  const averageScore =
    scoredAttempts.length > 0
      ? Math.round((totalScoreSum / scoredAttempts.length) * 10) / 10
      : 0;

  const passingRate =
    scoredAttempts.length > 0
      ? Math.round((passedCount / scoredAttempts.length) * 100)
      : 0;

  // Attendance Analytics Calculations
  let present = 0;
  let sick = 0;
  let permission = 0;
  let absent = 0;

  for (const group of attendanceCounts) {
    if (group.status === AttendanceStatus.PRESENT) present = group._count.status;
    else if (group.status === AttendanceStatus.SICK) sick = group._count.status;
    else if (group.status === AttendanceStatus.PERMISSION) permission = group._count.status;
    else if (group.status === AttendanceStatus.ABSENT) absent = group._count.status;
  }

  const totalRecords = present + sick + permission + absent;
  const attendanceRate =
    totalRecords > 0 ? Math.round((present / totalRecords) * 100) : 0;

  // Format Top Courses
  const topCourses = coursesWithGrades.map((c) => {
    const scores = c.grades.map((g) => g.score);
    const avgScore =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;

    return {
      id: c.id,
      title: c.title,
      teacherName: c.teacher.name,
      category: c.category?.name || 'Mata Pelajaran',
      modulesCount: c._count.modules,
      studentsCount: c._count.enrollments,
      avgScore,
    };
  });

  return {
    school: {
      id: school?.id || schoolId,
      name: school?.name || 'Sekolah',
      logo: school?.logo || null,
      defaultPassingGrade: passingThreshold,
    },
    academicYear: activeAcademicYear,
    counts: {
      teachers: teacherCount,
      students: studentCount,
      courses: courseCount,
      activeCourses: activeCourseCount,
      modules: moduleCount,
    },
    cbtAnalytics: {
      totalQuizzes,
      completedAttempts: scoredAttempts.length,
      averageScore,
      passingRate,
      passingThreshold,
      passedCount,
    },
    attendanceAnalytics: {
      totalRecords,
      present,
      sick,
      permission,
      absent,
      attendanceRate,
    },
    topCourses,
  };
}
