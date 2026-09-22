'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function getTeacherActivityStats(schoolId: string, academicYearId?: string) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const whereCourse: Record<string, unknown> = { schoolId };
  if (academicYearId) {
    whereCourse.academicYearId = academicYearId;
  }

  const teachers = await db.user.findMany({
    where: { schoolId, role: 'TEACHER', isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      nip: true,
      teacherCourses: {
        where: whereCourse,
        select: {
          id: true,
          title: true,
          status: true,
          _count: {
            select: {
              modules: true,
              enrollments: true,
            },
          },
          modules: {
            select: {
              _count: {
                select: {
                  contents: true,
                  quizzes: true,
                  assignments: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return teachers.map((teacher) => {
    const courseCount = teacher.teacherCourses.length;
    const activeCourseCount = teacher.teacherCourses.filter((c) => c.status === 'ACTIVE').length;
    const totalStudentsEnrolled = teacher.teacherCourses.reduce((acc, c) => acc + c._count.enrollments, 0);
    const totalModules = teacher.teacherCourses.reduce((acc, c) => acc + c._count.modules, 0);
    const totalContents = teacher.teacherCourses.reduce(
      (acc, c) => acc + c.modules.reduce((mAcc, m) => mAcc + m._count.contents, 0),
      0
    );
    const totalQuizzes = teacher.teacherCourses.reduce(
      (acc, c) => acc + c.modules.reduce((mAcc, m) => mAcc + m._count.quizzes, 0),
      0
    );
    const totalAssignments = teacher.teacherCourses.reduce(
      (acc, c) => acc + c.modules.reduce((mAcc, m) => mAcc + m._count.assignments, 0),
      0
    );

    return {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      nip: teacher.nip || '-',
      courseCount,
      activeCourseCount,
      totalStudentsEnrolled,
      totalModules,
      totalContents,
      totalQuizzes,
      totalAssignments,
      courses: teacher.teacherCourses.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        enrollmentsCount: c._count.enrollments,
        modulesCount: c._count.modules,
      })),
    };
  });
}

export async function getStudentActivityStats(schoolId: string) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const students = await db.user.findMany({
    where: { schoolId, role: 'STUDENT', isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      nis: true,
      cohortMemberships: {
        select: {
          cohort: {
            select: { name: true },
          },
        },
      },
      _count: {
        select: {
          enrollments: true,
          quizAttempts: true,
          assignmentSubmissions: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return students.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    nis: s.nis || '-',
    cohort: s.cohortMemberships[0]?.cohort.name || 'Umum',
    enrolledCourses: s._count.enrollments,
    quizzesCompleted: s._count.quizAttempts,
    assignmentsSubmitted: s._count.assignmentSubmissions,
  }));
}

export async function getSchoolReportsOverview(schoolId: string, academicYearId?: string) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const whereCourse: Record<string, unknown> = { schoolId };
  if (academicYearId) {
    whereCourse.academicYearId = academicYearId;
  }

  const courses = await db.course.findMany({
    where: whereCourse,
    include: {
      teacher: { select: { name: true } },
      academicYear: { select: { name: true } },
      category: { select: { name: true } },
      _count: {
        select: {
          enrollments: true,
          modules: true,
        },
      },
      grades: {
        select: {
          score: true,
        },
      },
    },
    orderBy: { title: 'asc' },
  });

  return courses.map((c) => {
    const scores = c.grades.map((g) => g.score);
    const avgScore =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;

    return {
      id: c.id,
      title: c.title,
      teacher: c.teacher.name,
      academicYear: c.academicYear.name,
      category: c.category?.name || 'Umum',
      studentsCount: c._count.enrollments,
      modulesCount: c._count.modules,
      gradesRecorded: scores.length,
      averageScore: avgScore,
    };
  });
}
