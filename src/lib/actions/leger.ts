'use server';

import { db } from '@/lib/db';
import { requireSchool } from '@/lib/auth-utils';
import { AttendanceStatus } from '@prisma/client';

export interface LegerSubject {
  id: string;
  title: string;
  teacherName: string;
}

export interface LegerStudentAttendance {
  present: number;
  sick: number;
  permission: number;
  absent: number;
  totalSessions: number;
}

export interface LegerStudentRow {
  userId: string;
  name: string;
  nis: string | null;
  subjectGrades: Record<string, number | null>; // courseId -> average score (0-100) or null
  totalScore: number;
  averageScore: number | null;
  rank: number;
  attendance: LegerStudentAttendance;
  isPassed: boolean; // Berdasarkan passingGrade sekolah
}

export interface LegerSubjectStats {
  courseId: string;
  courseTitle: string;
  average: number | null;
  highest: number | null;
  lowest: number | null;
}

export interface CohortLegerReportData {
  school: {
    name: string;
    code: string;
    address: string | null;
    phone: string | null;
    logo: string | null;
    passingGrade: number;
  };
  cohort: {
    id: string;
    name: string;
    totalStudents: number;
    homeroomTeacher: {
      id: string;
      name: string;
    } | null;
  };
  academicYear: {
    id: string;
    name: string;
  } | null;
  subjects: LegerSubject[];
  students: LegerStudentRow[];
  subjectStats: Record<string, LegerSubjectStats>;
  overallClassAverage: number | null;
}

/**
 * Mengambil dan mengompilasi data Leger Nilai untuk satu rombel/kohort
 */
export async function getCohortLegerData({
  cohortId,
  academicYearId,
}: {
  cohortId: string;
  academicYearId?: string;
}): Promise<CohortLegerReportData | null> {
  const session = await requireSchool();
  const schoolId = session.schoolId;
  const userRole = session.user.role;
  const userId = session.user.id;

  // 1. Ambil data sekolah & kohort
  const [school, cohort] = await Promise.all([
    db.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        code: true,
        address: true,
        phone: true,
        logo: true,
        defaultPassingGrade: true,
      },
    }),
    db.cohort.findUnique({
      where: { id: cohortId, schoolId },
      include: {
        homeroomTeacher: {
          select: {
            id: true,
            name: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                nis: true,
                email: true,
              },
            },
          },
          orderBy: {
            user: { name: 'asc' },
          },
        },
      },
    }),
  ]);

  if (!school || !cohort) return null;

  // Otorisasi guru: hanya wali kelas yang dapat mengakses data rombel ini
  if (userRole === 'TEACHER' && cohort.homeroomTeacherId !== userId) {
    return null;
  }

  const passingGrade = school.defaultPassingGrade ?? 75;
  const studentMembers = cohort.members.map((m) => m.user);
  const studentIds = studentMembers.map((s) => s.id);

  // 2. Tentukan Tahun Ajaran
  let selectedAcademicYear = null;
  if (academicYearId) {
    selectedAcademicYear = await db.academicYear.findUnique({
      where: { id: academicYearId, schoolId },
      select: { id: true, name: true },
    });
  } else {
    selectedAcademicYear = await db.academicYear.findFirst({
      where: { schoolId, status: 'ACTIVE' },
      select: { id: true, name: true },
    });
  }

  // 3. Cari Course yang diikuti oleh siswa di kohort ini (termasuk kursus lintas sekolah seperti Student Day)
  const courses = await db.course.findMany({
    where: {
      status: { in: ['ACTIVE', 'ARCHIVED'] },
      ...(selectedAcademicYear ? { academicYearId: selectedAcademicYear.id } : {}),
      AND: [
        {
          OR: [
            { schoolId },
            { isCrossSchool: true },
          ],
        },
        {
          OR: [
            {
              enrollments: {
                some: { cohortId: cohort.id },
              },
            },
            {
              enrollments: {
                some: { userId: { in: studentIds } },
              },
            },
          ],
        },
      ],
    },
    include: {
      teacher: { select: { name: true } },
      modules: {
        include: {
          quizzes: { select: { id: true, title: true } },
          assignments: { select: { id: true, title: true, maxScore: true } },
          attendanceSessions: { select: { id: true } },
        },
      },
      attendanceSessions: { select: { id: true } },
    },
    orderBy: { title: 'asc' },
  });

  const subjects: LegerSubject[] = courses.map((c) => ({
    id: c.id,
    title: c.title,
    teacherName: c.teacher?.name || 'Guru Pengampu',
  }));

  const courseIds = courses.map((c) => c.id);

  const allQuizIds: string[] = [];
  const allAssignmentIds: string[] = [];
  const allAttendanceSessionIds: string[] = [];

  courses.forEach((c) => {
    c.modules.forEach((m) => {
      m.quizzes.forEach((q) => allQuizIds.push(q.id));
      m.assignments.forEach((a) => allAssignmentIds.push(a.id));
      m.attendanceSessions.forEach((att) => allAttendanceSessionIds.push(att.id));
    });
    c.attendanceSessions.forEach((att) => allAttendanceSessionIds.push(att.id));
  });

  // 4. Ambil Data Nilai Siswa (Bulk Fetch)
  const [quizAttempts, submissions, manualGrades, attendanceRecords] = await Promise.all([
    allQuizIds.length > 0 && studentIds.length > 0
      ? db.quizAttempt.findMany({
          where: {
            quizId: { in: allQuizIds },
            userId: { in: studentIds },
            submittedAt: { not: null },
          },
          select: {
            userId: true,
            quizId: true,
            score: true,
            quiz: { select: { module: { select: { courseId: true } } } },
          },
          orderBy: { startedAt: 'desc' },
        })
      : [],
    allAssignmentIds.length > 0 && studentIds.length > 0
      ? db.assignmentSubmission.findMany({
          where: {
            assignmentId: { in: allAssignmentIds },
            userId: { in: studentIds },
          },
          select: {
            userId: true,
            assignmentId: true,
            score: true,
            assignment: {
              select: {
                maxScore: true,
                module: { select: { courseId: true } },
              },
            },
          },
        })
      : [],
    courseIds.length > 0 && studentIds.length > 0
      ? db.grade.findMany({
          where: {
            courseId: { in: courseIds },
            userId: { in: studentIds },
          },
          select: {
            courseId: true,
            userId: true,
            score: true,
            maxScore: true,
          },
        })
      : [],
    allAttendanceSessionIds.length > 0 && studentIds.length > 0
      ? db.attendanceRecord.findMany({
          where: {
            sessionId: { in: allAttendanceSessionIds },
            userId: { in: studentIds },
          },
          select: {
            userId: true,
            status: true,
          },
        })
      : [],
  ]);

  // Mapping Quiz per Siswa & Mapel: userId -> courseId -> quizId -> bestScore
  const studentCourseQuizScores = new Map<string, Map<string, Map<string, number>>>();
  for (const qa of quizAttempts) {
    if (qa.score === null) continue;
    const courseId = qa.quiz.module.courseId;
    if (!studentCourseQuizScores.has(qa.userId)) {
      studentCourseQuizScores.set(qa.userId, new Map());
    }
    const cMap = studentCourseQuizScores.get(qa.userId)!;
    if (!cMap.has(courseId)) {
      cMap.set(courseId, new Map());
    }
    const qMap = cMap.get(courseId)!;
    const prev = qMap.get(qa.quizId);
    if (prev === undefined || qa.score > prev) {
      qMap.set(qa.quizId, qa.score);
    }
  }

  // Mapping Assignment per Siswa & Mapel: userId -> courseId -> assignmentId -> scaledScore (0-100)
  const studentCourseAssignScores = new Map<string, Map<string, Map<string, number>>>();
  for (const sub of submissions) {
    if (sub.score === null) continue;
    const courseId = sub.assignment.module.courseId;
    const maxScore = sub.assignment.maxScore || 100;
    const scaledScore = maxScore > 0 ? (sub.score / maxScore) * 100 : sub.score;

    if (!studentCourseAssignScores.has(sub.userId)) {
      studentCourseAssignScores.set(sub.userId, new Map());
    }
    const cMap = studentCourseAssignScores.get(sub.userId)!;
    if (!cMap.has(courseId)) {
      cMap.set(courseId, new Map());
    }
    const aMap = cMap.get(courseId)!;
    aMap.set(sub.assignmentId, scaledScore);
  }

  // Mapping Manual Grade per Siswa & Mapel: userId -> courseId -> scores[]
  const studentCourseManualScores = new Map<string, Map<string, number[]>>();
  for (const g of manualGrades) {
    if (g.score === null) continue;
    const max = g.maxScore || 100;
    const scaled = max > 0 ? (g.score / max) * 100 : g.score;

    if (!studentCourseManualScores.has(g.userId)) {
      studentCourseManualScores.set(g.userId, new Map());
    }
    const cMap = studentCourseManualScores.get(g.userId)!;
    if (!cMap.has(g.courseId)) {
      cMap.set(g.courseId, []);
    }
    cMap.get(g.courseId)!.push(scaled);
  }

  // Mapping Presensi Siswa: userId -> { present, sick, permission, absent, totalSessions }
  const studentAttendanceMap = new Map<string, LegerStudentAttendance>();
  for (const sId of studentIds) {
    studentAttendanceMap.set(sId, {
      present: 0,
      sick: 0,
      permission: 0,
      absent: 0,
      totalSessions: 0,
    });
  }

  for (const att of attendanceRecords) {
    const stats = studentAttendanceMap.get(att.userId);
    if (!stats) continue;
    stats.totalSessions++;
    if (att.status === AttendanceStatus.PRESENT) stats.present++;
    else if (att.status === AttendanceStatus.SICK) stats.sick++;
    else if (att.status === AttendanceStatus.PERMISSION) stats.permission++;
    else if (att.status === AttendanceStatus.ABSENT) stats.absent++;
  }

  // 5. Hitung Nilai Akhir Tiap Mapel untuk Setiap Siswa
  const studentRows: Omit<LegerStudentRow, 'rank'>[] = studentMembers.map((student) => {
    const subjectGrades: Record<string, number | null> = {};
    let totalScore = 0;
    let subjectsWithScoresCount = 0;

    for (const sub of subjects) {
      const qMap = studentCourseQuizScores.get(student.id)?.get(sub.id);
      const aMap = studentCourseAssignScores.get(student.id)?.get(sub.id);
      const mList = studentCourseManualScores.get(student.id)?.get(sub.id);

      const allComponentScores: number[] = [];
      if (qMap) qMap.forEach((val) => allComponentScores.push(val));
      if (aMap) aMap.forEach((val) => allComponentScores.push(val));
      if (mList) mList.forEach((val) => allComponentScores.push(val));

      if (allComponentScores.length > 0) {
        const sum = allComponentScores.reduce((acc, curr) => acc + curr, 0);
        const avg = Math.round((sum / allComponentScores.length) * 10) / 10;
        subjectGrades[sub.id] = avg;
        totalScore += avg;
        subjectsWithScoresCount++;
      } else {
        subjectGrades[sub.id] = null;
      }
    }

    const averageScore =
      subjectsWithScoresCount > 0
        ? Math.round((totalScore / subjectsWithScoresCount) * 10) / 10
        : null;

    const isPassed = averageScore !== null ? averageScore >= passingGrade : false;

    return {
      userId: student.id,
      name: student.name,
      nis: student.nis,
      subjectGrades,
      totalScore: Math.round(totalScore * 10) / 10,
      averageScore,
      attendance: studentAttendanceMap.get(student.id) || {
        present: 0,
        sick: 0,
        permission: 0,
        absent: 0,
        totalSessions: 0,
      },
      isPassed,
    };
  });

  // 6. Hitung Ranking (Peringkat 1 s/d N)
  const sortedStudents = [...studentRows].sort((a, b) => {
    if (a.averageScore === null && b.averageScore === null) return 0;
    if (a.averageScore === null) return 1;
    if (b.averageScore === null) return -1;
    if (b.averageScore !== a.averageScore) {
      return b.averageScore - a.averageScore;
    }
    return b.totalScore - a.totalScore;
  });

  const rankedStudentMap = new Map<string, number>();
  sortedStudents.forEach((st, index) => {
    rankedStudentMap.set(st.userId, index + 1);
  });

  const finalStudents: LegerStudentRow[] = studentRows.map((st) => ({
    ...st,
    rank: rankedStudentMap.get(st.userId) || 0,
  }));

  // 7. Hitung Statistik Kelas per Mata Pelajaran
  const subjectStats: Record<string, LegerSubjectStats> = {};
  const allStudentAverages: number[] = [];

  subjects.forEach((sub) => {
    const scores = finalStudents
      .map((st) => st.subjectGrades[sub.id])
      .filter((s): s is number => s !== null);

    if (scores.length > 0) {
      const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
      const highest = Math.max(...scores);
      const lowest = Math.min(...scores);
      subjectStats[sub.id] = {
        courseId: sub.id,
        courseTitle: sub.title,
        average: avg,
        highest,
        lowest,
      };
    } else {
      subjectStats[sub.id] = {
        courseId: sub.id,
        courseTitle: sub.title,
        average: null,
        highest: null,
        lowest: null,
      };
    }
  });

  finalStudents.forEach((st) => {
    if (st.averageScore !== null) {
      allStudentAverages.push(st.averageScore);
    }
  });

  const overallClassAverage =
    allStudentAverages.length > 0
      ? Math.round(
          (allStudentAverages.reduce((a, b) => a + b, 0) / allStudentAverages.length) * 10
        ) / 10
      : null;

  return {
    school: {
      name: school.name,
      code: school.code,
      address: school.address,
      phone: school.phone,
      logo: school.logo,
      passingGrade,
    },
    cohort: {
      id: cohort.id,
      name: cohort.name,
      totalStudents: studentMembers.length,
      homeroomTeacher: cohort.homeroomTeacher
        ? {
            id: cohort.homeroomTeacher.id,
            name: cohort.homeroomTeacher.name,
          }
        : null,
    },
    academicYear: selectedAcademicYear,
    subjects,
    students: finalStudents,
    subjectStats,
    overallClassAverage,
  };
}

/**
 * Mengambil daftar kohort dan tahun ajaran untuk seleksi di halaman Leger Nilai
 */
export async function getLegerFilterOptions() {
  const session = await requireSchool();
  const schoolId = session.schoolId;
  const userRole = session.user.role;
  const userId = session.user.id;

  const cohortWhere: { schoolId: string; homeroomTeacherId?: string } = { schoolId };
  if (userRole === 'TEACHER') {
    cohortWhere.homeroomTeacherId = userId;
  }

  const [cohorts, academicYears] = await Promise.all([
    db.cohort.findMany({
      where: cohortWhere,
      select: {
        id: true,
        name: true,
        _count: { select: { members: true } },
      },
      orderBy: { name: 'asc' },
    }),
    db.academicYear.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        status: true,
      },
      orderBy: { startDate: 'desc' },
    }),
  ]);

  return {
    cohorts,
    academicYears,
  };
}
