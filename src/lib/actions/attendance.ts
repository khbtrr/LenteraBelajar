'use server';

import { db } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';
import { AttendanceStatus } from '@prisma/client';

export interface AttendanceSessionItem {
  id: string;
  courseId: string;
  moduleId: string | null;
  moduleTitle?: string | null;
  title: string;
  date: Date;
  startTime: Date | null;
  endTime: Date | null;
  token: string | null;
  allowSelfCheckin: boolean;
  isOpen: boolean;
  createdAt: Date;
  counts: {
    total: number;
    present: number;
    sick: number;
    permission: number;
    absent: number;
  };
}

export async function createAttendanceSession(data: {
  courseId: string;
  moduleId?: string;
  title: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  allowSelfCheckin?: boolean;
  token?: string;
}) {
  const session = await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  // Verify course belongs to teacher/admin's school
  const course = await db.course.findUnique({
    where: { id: data.courseId },
    include: { enrollments: { select: { userId: true } } },
  });

  if (!course) throw new Error('Kursus tidak ditemukan');
  if (session.user.role === 'TEACHER' && course.teacherId !== session.user.id) {
    throw new Error('Akses ditolak');
  }

  // Generate 6 digit token if not provided
  const generatedToken =
    data.token && data.token.trim().length > 0
      ? data.token.trim().toUpperCase()
      : Math.floor(100000 + Math.random() * 900000).toString();

  const sessionDate = data.date ? new Date(data.date) : new Date();

  const newSession = await db.attendanceSession.create({
    data: {
      courseId: data.courseId,
      moduleId: data.moduleId || null,
      title: data.title,
      date: sessionDate,
      startTime: data.startTime ? new Date(data.startTime) : null,
      endTime: data.endTime ? new Date(data.endTime) : null,
      token: generatedToken,
      allowSelfCheckin: data.allowSelfCheckin ?? true,
      isOpen: true,
      records: {
        create: course.enrollments.map((enr) => ({
          userId: enr.userId,
          status: AttendanceStatus.ABSENT,
        })),
      },
    },
  });

  revalidatePath(`/teacher/course/${data.courseId}/attendance`);
  revalidatePath(`/student/course/${data.courseId}/attendance`);

  return newSession;
}

export async function toggleAttendanceSession(sessionId: string, isOpen: boolean) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const updated = await db.attendanceSession.update({
    where: { id: sessionId },
    data: { isOpen },
  });

  revalidatePath(`/teacher/course/${updated.courseId}/attendance`);
  revalidatePath(`/student/course/${updated.courseId}/attendance`);
  return updated;
}

export async function deleteAttendanceSession(sessionId: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const session = await db.attendanceSession.delete({
    where: { id: sessionId },
  });

  revalidatePath(`/teacher/course/${session.courseId}/attendance`);
  revalidatePath(`/student/course/${session.courseId}/attendance`);
  return session;
}

export async function updateAttendanceRecord(
  recordId: string,
  status: AttendanceStatus,
  notes?: string
) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const updated = await db.attendanceRecord.update({
    where: { id: recordId },
    data: {
      status,
      notes: notes !== undefined ? notes : undefined,
      checkInAt: status === AttendanceStatus.PRESENT ? new Date() : null,
    },
    include: {
      session: { select: { courseId: true } },
    },
  });

  revalidatePath(`/teacher/course/${updated.session.courseId}/attendance`);
  return updated;
}

export async function bulkUpdateAttendanceRecords(
  sessionId: string,
  updates: Array<{ recordId: string; status: AttendanceStatus; notes?: string }>
) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  for (const item of updates) {
    await db.attendanceRecord.update({
      where: { id: item.recordId },
      data: {
        status: item.status,
        notes: item.notes,
        checkInAt: item.status === AttendanceStatus.PRESENT ? new Date() : null,
      },
    });
  }

  const session = await db.attendanceSession.findUnique({
    where: { id: sessionId },
    select: { courseId: true },
  });

  if (session) {
    revalidatePath(`/teacher/course/${session.courseId}/attendance`);
  }

  return { success: true };
}

export async function studentCheckIn(sessionId: string, token: string) {
  const userSession = await requireAuth();
  const userId = userSession.user.id;

  const attendanceSession = await db.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      course: {
        include: {
          enrollments: { where: { userId } },
        },
      },
    },
  });

  if (!attendanceSession) {
    return { success: false, error: 'Sesi presensi tidak ditemukan.' };
  }

  if (!attendanceSession.isOpen) {
    return { success: false, error: 'Sesi presensi telah ditutup oleh guru.' };
  }

  if (!attendanceSession.allowSelfCheckin) {
    return { success: false, error: 'Check-in mandiri tidak diizinkan untuk sesi ini.' };
  }

  if (attendanceSession.course.enrollments.length === 0) {
    return { success: false, error: 'Anda tidak terdaftar dalam mata pelajaran ini.' };
  }

  if (attendanceSession.token && attendanceSession.token.toUpperCase() !== token.trim().toUpperCase()) {
    return { success: false, error: 'Kode token presensi tidak sesuai.' };
  }

  // Check end time if defined
  if (attendanceSession.endTime && new Date() > new Date(attendanceSession.endTime)) {
    return { success: false, error: 'Batas waktu sesi presensi telah berakhir.' };
  }

  // Upsert attendance record
  await db.attendanceRecord.upsert({
    where: {
      sessionId_userId: {
        sessionId,
        userId,
      },
    },
    update: {
      status: AttendanceStatus.PRESENT,
      checkInAt: new Date(),
    },
    create: {
      sessionId,
      userId,
      status: AttendanceStatus.PRESENT,
      checkInAt: new Date(),
    },
  });

  revalidatePath(`/student/course/${attendanceSession.courseId}/attendance`);
  revalidatePath(`/teacher/course/${attendanceSession.courseId}/attendance`);

  return { success: true };
}

export async function getCourseAttendanceSessions(courseId: string): Promise<AttendanceSessionItem[]> {
  await requireAuth();

  const sessions = await db.attendanceSession.findMany({
    where: { courseId },
    orderBy: { date: 'desc' },
    include: {
      module: { select: { title: true } },
      records: {
        select: { status: true },
      },
    },
  });

  return sessions.map((s) => {
    const counts = {
      total: s.records.length,
      present: s.records.filter((r) => r.status === AttendanceStatus.PRESENT).length,
      sick: s.records.filter((r) => r.status === AttendanceStatus.SICK).length,
      permission: s.records.filter((r) => r.status === AttendanceStatus.PERMISSION).length,
      absent: s.records.filter((r) => r.status === AttendanceStatus.ABSENT).length,
    };
    return {
      id: s.id,
      courseId: s.courseId,
      moduleId: s.moduleId,
      moduleTitle: s.module?.title || null,
      title: s.title,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      token: s.token,
      allowSelfCheckin: s.allowSelfCheckin,
      isOpen: s.isOpen,
      createdAt: s.createdAt,
      counts,
    };
  });
}

export async function getSessionDetails(sessionId: string) {
  await requireAuth();

  const session = await db.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      module: { select: { id: true, title: true } },
      course: {
        select: {
          id: true,
          title: true,
          teacherId: true,
          enrollments: {
            include: {
              user: {
                select: { id: true, name: true, email: true, nis: true },
              },
            },
          },
        },
      },
      records: {
        include: {
          user: {
            select: { id: true, name: true, email: true, nis: true },
          },
        },
      },
    },
  });

  if (!session) return null;

  // Make sure every enrolled student has a record in view
  const recordUserMap = new Map(session.records.map((r) => [r.userId, r]));
  const combinedRecords = session.course.enrollments.map((enr) => {
    const existing = recordUserMap.get(enr.userId);
    if (existing) return existing;
    return {
      id: `temp-${enr.userId}`,
      sessionId: session.id,
      userId: enr.userId,
      status: AttendanceStatus.ABSENT,
      checkInAt: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: enr.user,
    };
  });

  return {
    ...session,
    records: combinedRecords,
  };
}

export async function getStudentAttendanceOverview(courseId: string, targetStudentId?: string) {
  const session = await requireAuth();
  const studentId = targetStudentId || session.user.id;

  const sessions = await db.attendanceSession.findMany({
    where: { courseId },
    orderBy: { date: 'asc' },
    include: {
      module: { select: { title: true } },
      records: {
        where: { userId: studentId },
      },
    },
  });

  const history = sessions.map((s) => {
    const record = s.records[0];
    return {
      sessionId: s.id,
      title: s.title,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      isOpen: s.isOpen,
      allowSelfCheckin: s.allowSelfCheckin,
      moduleTitle: s.module?.title || null,
      status: record ? record.status : AttendanceStatus.ABSENT,
      checkInAt: record?.checkInAt || null,
      notes: record?.notes || null,
    };
  });

  const totalSessions = history.length;
  const presentCount = history.filter((h) => h.status === AttendanceStatus.PRESENT).length;
  const sickCount = history.filter((h) => h.status === AttendanceStatus.SICK).length;
  const permissionCount = history.filter((h) => h.status === AttendanceStatus.PERMISSION).length;
  const absentCount = history.filter((h) => h.status === AttendanceStatus.ABSENT).length;

  const attendanceRate = totalSessions > 0 ? Math.round(((presentCount + permissionCount) / totalSessions) * 100) : 100;

  return {
    totalSessions,
    presentCount,
    sickCount,
    permissionCount,
    absentCount,
    attendanceRate,
    history,
  };
}

export async function getCourseAttendanceRecap(courseId: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      enrollments: {
        include: {
          user: {
            select: { id: true, name: true, email: true, nis: true },
          },
        },
      },
      attendanceSessions: {
        orderBy: { date: 'asc' },
        include: {
          records: true,
        },
      },
    },
  });

  if (!course) throw new Error('Kursus tidak ditemukan');

  const totalSessions = course.attendanceSessions.length;

  const studentRecap = course.enrollments.map((enr) => {
    let present = 0;
    let sick = 0;
    let permission = 0;
    let absent = 0;

    const sessionStatusList = course.attendanceSessions.map((sess) => {
      const rec = sess.records.find((r) => r.userId === enr.userId);
      const status = rec ? rec.status : AttendanceStatus.ABSENT;
      if (status === AttendanceStatus.PRESENT) present++;
      else if (status === AttendanceStatus.SICK) sick++;
      else if (status === AttendanceStatus.PERMISSION) permission++;
      else absent++;

      return {
        sessionId: sess.id,
        sessionTitle: sess.title,
        date: sess.date,
        status,
      };
    });

    const rate = totalSessions > 0 ? Math.round(((present + permission) / totalSessions) * 100) : 100;

    return {
      student: enr.user,
      present,
      sick,
      permission,
      absent,
      totalSessions,
      rate,
      sessions: sessionStatusList,
    };
  });

  return {
    sessions: course.attendanceSessions.map((s) => ({
      id: s.id,
      title: s.title,
      date: s.date,
    })),
    students: studentRecap,
  };
}

export async function syncAttendanceToGradebook(
  courseId: string,
  label: string = 'Nilai Kehadiran',
  maxScore: number = 100
) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const recap = await getCourseAttendanceRecap(courseId);

  if (recap.sessions.length === 0) {
    throw new Error('Belum ada sesi presensi untuk disinkronkan');
  }

  for (const item of recap.students) {
    const score = Number(((item.rate / 100) * maxScore).toFixed(1));

    const existingGrade = await db.grade.findFirst({
      where: {
        courseId,
        userId: item.student.id,
        type: 'ATTENDANCE',
      },
    });

    if (existingGrade) {
      await db.grade.update({
        where: { id: existingGrade.id },
        data: {
          label,
          score,
          maxScore,
        },
      });
    } else {
      await db.grade.create({
        data: {
          courseId,
          userId: item.student.id,
          label,
          score,
          maxScore,
          type: 'ATTENDANCE',
        },
      });
    }
  }

  revalidatePath(`/teacher/course/${courseId}/gradebook`);
  revalidatePath(`/student/course/${courseId}/grades`);
  return { success: true, count: recap.students.length };
}
