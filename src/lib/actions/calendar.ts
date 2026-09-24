'use server';

import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';
import { CalendarEventScope, CalendarEventCategory } from '@prisma/client';
import { createBulkNotifications } from './notification';

export interface CalendarItem {
  id: string;
  title: string;
  description?: string | null;
  startDate: string; // ISO string
  endDate?: string | null;
  isAllDay: boolean;
  type: 'ASSIGNMENT' | 'QUIZ' | 'ATTENDANCE' | 'CUSTOM';
  category: 'TUGAS' | 'KUIS' | 'PRESENSI' | 'SEKOLAH' | 'KELAS' | 'PRIBADI';
  scope?: 'SCHOOL' | 'COURSE' | 'PERSONAL';
  courseId?: string | null;
  courseTitle?: string | null;
  link?: string | null;
  color?: string | null;
  location?: string | null;
  canEdit?: boolean;
}

/**
 * Retrieves merged calendar events (Assignments, Quizzes, Attendance, and Custom Events)
 * based on the authenticated user's role and enrolled/taught courses.
 */
export async function getCalendarEvents(filters?: {
  month?: number; // 0-11
  year?: number;
  courseId?: string;
  category?: string;
}): Promise<CalendarItem[]> {
  const session = await requireAuth();
  const userId = session.user.id;
  const userRole = session.user.role;
  const activeSchoolId = session.user.schoolId;

  // Compute date range window: default to +/- 45 days around target date
  const targetYear = filters?.year ?? new Date().getFullYear();
  const targetMonth = filters?.month ?? new Date().getMonth();
  const startWindow = new Date(targetYear, targetMonth - 1, 1);
  const endWindow = new Date(targetYear, targetMonth + 2, 0, 23, 59, 59);

  const courseSchoolFilter = activeSchoolId
    ? [{ schoolId: activeSchoolId }, { isCrossSchool: true }]
    : [{ isCrossSchool: true }];

  // 1. Identify relevant course IDs for user (scoped to active school & enrolled courses)
  let relevantCourseIds: string[] = [];

  if (userRole === 'STUDENT') {
    const enrollments = await db.enrollment.findMany({
      where: {
        userId,
        course: {
          OR: courseSchoolFilter,
        },
      },
      select: { courseId: true },
    });
    const enrolledIds = enrollments.map((e) => e.courseId);

    // If student specifies a course filter, ONLY allow if they are actually enrolled in it
    if (filters?.courseId && filters.courseId !== 'ALL') {
      relevantCourseIds = enrolledIds.includes(filters.courseId) ? [filters.courseId] : [];
    } else {
      relevantCourseIds = enrolledIds;
    }
  } else if (userRole === 'TEACHER') {
    const courses = await db.course.findMany({
      where: {
        teacherId: userId,
        OR: courseSchoolFilter,
      },
      select: { id: true },
    });
    const teacherCourseIds = courses.map((c) => c.id);

    if (filters?.courseId && filters.courseId !== 'ALL') {
      relevantCourseIds = teacherCourseIds.includes(filters.courseId) ? [filters.courseId] : [];
    } else {
      relevantCourseIds = teacherCourseIds;
    }
  } else {
    // Admin, Super Admin, Supervisor: scoped to active school or cross-school courses
    const allCourses = await db.course.findMany({
      where: {
        OR: courseSchoolFilter,
      },
      select: { id: true },
    });
    const schoolCourseIds = allCourses.map((c) => c.id);

    if (filters?.courseId && filters.courseId !== 'ALL') {
      relevantCourseIds = schoolCourseIds.includes(filters.courseId) ? [filters.courseId] : [];
    } else {
      relevantCourseIds = schoolCourseIds;
    }
  }

  const items: CalendarItem[] = [];

  // Helper for links based on role
  const isStudent = userRole === 'STUDENT';

  // 2. Fetch Assignments (only if user has relevant courses)
  if (relevantCourseIds.length > 0 && (!filters?.category || filters.category === 'ALL' || filters.category === 'TUGAS')) {
    const assignments = await db.assignment.findMany({
      where: {
        deadline: {
          gte: startWindow,
          lte: endWindow,
        },
        module: {
          courseId: { in: relevantCourseIds },
        },
      },
      include: {
        module: {
          include: {
            course: { select: { id: true, title: true } },
          },
        },
      },
    });

    for (const a of assignments) {
      if (!a.deadline) continue;
      items.push({
        id: `assignment-${a.id}`,
        title: `[Tugas] ${a.title}`,
        description: a.description || 'Pengumpulan tugas mata pelajaran.',
        startDate: a.deadline.toISOString(),
        endDate: a.deadline.toISOString(),
        isAllDay: false,
        type: 'ASSIGNMENT',
        category: 'TUGAS',
        courseId: a.module.course.id,
        courseTitle: a.module.course.title,
        link: isStudent
          ? `/student/course/${a.module.course.id}/assignment/${a.id}`
          : `/teacher/course/${a.module.course.id}/submissions/${a.id}`,
        color: '#9333ea', // purple
        canEdit: false,
      });
    }
  }

  // 3. Fetch Quizzes (only if user has relevant courses)
  if (relevantCourseIds.length > 0 && (!filters?.category || filters.category === 'ALL' || filters.category === 'KUIS')) {
    const quizzes = await db.quiz.findMany({
      where: {
        deadline: {
          gte: startWindow,
          lte: endWindow,
        },
        module: {
          courseId: { in: relevantCourseIds },
        },
      },
      include: {
        module: {
          include: {
            course: { select: { id: true, title: true } },
          },
        },
      },
    });

    for (const q of quizzes) {
      if (!q.deadline) continue;
      items.push({
        id: `quiz-${q.id}`,
        title: `[Kuis CBT] ${q.title}`,
        description: q.description || 'Pengerjaan kuis ujian online.',
        startDate: q.deadline.toISOString(),
        endDate: q.deadline.toISOString(),
        isAllDay: false,
        type: 'QUIZ',
        category: 'KUIS',
        courseId: q.module.course.id,
        courseTitle: q.module.course.title,
        link: isStudent
          ? `/student/course/${q.module.course.id}/quiz/${q.id}`
          : `/teacher/course/${q.module.course.id}/quiz-attempts/${q.id}`,
        color: '#f59e0b', // amber
        canEdit: false,
      });
    }
  }

  // 4. Fetch Attendance Sessions (only if user has relevant courses)
  if (relevantCourseIds.length > 0 && (!filters?.category || filters.category === 'ALL' || filters.category === 'PRESENSI')) {
    const attendanceSessions = await db.attendanceSession.findMany({
      where: {
        date: {
          gte: startWindow,
          lte: endWindow,
        },
        courseId: { in: relevantCourseIds },
      },
      include: {
        course: { select: { id: true, title: true } },
      },
    });

    for (const att of attendanceSessions) {
      const sessionDate = new Date(att.date);
      let startDateStr = sessionDate.toISOString();
      let endDateStr = sessionDate.toISOString();

      if (att.startTime) {
        const sTime = new Date(att.startTime);
        sessionDate.setHours(sTime.getHours(), sTime.getMinutes(), 0, 0);
        startDateStr = sessionDate.toISOString();
      }

      if (att.endTime) {
        const eTime = new Date(att.endTime);
        const endD = new Date(att.date);
        endD.setHours(eTime.getHours(), eTime.getMinutes(), 0, 0);
        endDateStr = endD.toISOString();
      }

      items.push({
        id: `attendance-${att.id}`,
        title: `[Presensi] ${att.title}`,
        description: `Sesi presensi kehadiran kelas ${att.course.title}`,
        startDate: startDateStr,
        endDate: endDateStr,
        isAllDay: !att.startTime,
        type: 'ATTENDANCE',
        category: 'PRESENSI',
        courseId: att.course.id,
        courseTitle: att.course.title,
        link: isStudent
          ? `/student/course/${att.course.id}/attendance`
          : `/teacher/course/${att.course.id}/attendance`,
        color: '#10b981', // emerald
        canEdit: false,
      });
    }
  }

  // 5. Fetch Custom Calendar Events
  const customEventWhere: any = {
    startDate: { lte: endWindow },
    OR: [
      { endDate: { gte: startWindow } },
      { endDate: null, startDate: { gte: startWindow } },
    ],
  };

  // Scope permissions filter
  if (filters?.courseId && filters.courseId !== 'ALL') {
    // If filtering by a specific course, only show that course's events if permitted
    if (relevantCourseIds.includes(filters.courseId)) {
      customEventWhere.courseId = filters.courseId;
      customEventWhere.scope = CalendarEventScope.COURSE;
    } else {
      // User is not authorized to see events for this course
      customEventWhere.id = '__NO_ACCESS__';
    }
  } else {
    // Default view: Personal + School (active school only) + Course (enrolled/teaching courses only)
    const scopeConditions: any[] = [
      { creatorId: userId, scope: CalendarEventScope.PERSONAL },
    ];

    if (activeSchoolId) {
      scopeConditions.push({
        scope: CalendarEventScope.SCHOOL,
        OR: [
          { schoolId: activeSchoolId },
          { schoolId: null },
        ],
      });
    } else {
      scopeConditions.push({
        scope: CalendarEventScope.SCHOOL,
      });
    }

    if (relevantCourseIds.length > 0) {
      scopeConditions.push({
        scope: CalendarEventScope.COURSE,
        courseId: { in: relevantCourseIds },
      });
    }

    customEventWhere.AND = [{ OR: scopeConditions }];
  }

  const customEvents = await db.calendarEvent.findMany({
    where: customEventWhere,
    include: {
      course: { select: { id: true, title: true } },
      creator: { select: { id: true, name: true, role: true } },
    },
  });

  for (const ev of customEvents) {
    let catLabel: 'SEKOLAH' | 'KELAS' | 'PRIBADI' = 'PRIBADI';
    let defaultColor = '#3b82f6'; // blue

    if (ev.scope === CalendarEventScope.SCHOOL) {
      catLabel = 'SEKOLAH';
      defaultColor = '#dc2626'; // red
    } else if (ev.scope === CalendarEventScope.COURSE) {
      catLabel = 'KELAS';
      defaultColor = '#0284c7'; // sky blue
    } else {
      catLabel = 'PRIBADI';
      defaultColor = '#64748b'; // slate
    }

    if (filters?.category && filters.category !== 'ALL' && filters.category !== catLabel) {
      continue;
    }

    const canEdit = ev.creatorId === userId || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

    items.push({
      id: `custom-${ev.id}`,
      title: ev.title,
      description: ev.description,
      startDate: ev.startDate.toISOString(),
      endDate: ev.endDate ? ev.endDate.toISOString() : null,
      isAllDay: ev.isAllDay,
      type: 'CUSTOM',
      category: catLabel,
      scope: ev.scope,
      courseId: ev.courseId,
      courseTitle: ev.course?.title,
      color: ev.color || defaultColor,
      location: ev.location,
      canEdit,
    });
  }

  // Sort ascending by start date
  items.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return items;
}

/**
 * Retrieves the courses list for the calendar dropdown filter.
 */
export async function getUserCoursesForCalendar() {
  const session = await requireAuth();
  const userId = session.user.id;
  const userRole = session.user.role;
  const activeSchoolId = session.user.schoolId;

  const courseSchoolFilter = activeSchoolId
    ? [{ schoolId: activeSchoolId }, { isCrossSchool: true }]
    : [{ isCrossSchool: true }];

  if (userRole === 'STUDENT') {
    const enrollments = await db.enrollment.findMany({
      where: {
        userId,
        course: {
          OR: courseSchoolFilter,
        },
      },
      include: {
        course: { select: { id: true, title: true } },
      },
    });
    return enrollments.map((e) => e.course);
  }

  if (userRole === 'TEACHER') {
    return db.course.findMany({
      where: {
        teacherId: userId,
        OR: courseSchoolFilter,
      },
      select: { id: true, title: true },
    });
  }

  return db.course.findMany({
    where: {
      OR: courseSchoolFilter,
    },
    select: { id: true, title: true },
  });
}

/**
 * Creates a new custom calendar event.
 */
export async function createCalendarEvent(data: {
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  isAllDay?: boolean;
  scope: CalendarEventScope;
  category?: CalendarEventCategory;
  color?: string;
  location?: string;
  courseId?: string;
}) {
  const session = await requireAuth();
  const userRole = session.user.role;
  const userId = session.user.id;
  const activeSchoolId = session.user.schoolId;

  if (!data.title || !data.title.trim()) {
    throw new Error('Judul agenda tidak boleh kosong');
  }

  // Scope permissions check
  if (data.scope === CalendarEventScope.SCHOOL) {
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw new Error('Hanya Admin yang dapat membuat Agenda Sekolah');
    }
  }

  if (data.scope === CalendarEventScope.COURSE) {
    if (userRole !== 'TEACHER' && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw new Error('Hanya Guru dan Admin yang dapat membuat Agenda Mata Pelajaran');
    }
    if (!data.courseId) {
      throw new Error('Mata pelajaran harus dipilih untuk agenda kelas');
    }
  }

  const startD = new Date(data.startDate);
  const endD = data.endDate ? new Date(data.endDate) : null;

  const event = await db.calendarEvent.create({
    data: {
      title: data.title.trim(),
      description: data.description?.trim() || null,
      startDate: startD,
      endDate: endD,
      isAllDay: data.isAllDay ?? false,
      scope: data.scope,
      category: data.category || CalendarEventCategory.ACADEMIC,
      color: data.color || null,
      location: data.location?.trim() || null,
      courseId: data.courseId || null,
      schoolId: activeSchoolId || null,
      creatorId: userId,
    },
  });

  // Notify course students if COURSE event
  if (data.scope === CalendarEventScope.COURSE && data.courseId) {
    try {
      const enrollments = await db.enrollment.findMany({
        where: { courseId: data.courseId },
        select: { userId: true },
      });
      if (enrollments.length > 0) {
        await createBulkNotifications(
          enrollments.map((e) => e.userId),
          {
            title: `Agenda Baru: ${data.title}`,
            message: `Guru telah menambahkan agenda "${data.title}" pada kalender kelas.`,
            type: 'ANNOUNCEMENT',
            link: '/calendar',
          }
        );
      }
    } catch (notifyErr) {
      console.error('Failed to notify students of new calendar event:', notifyErr);
    }
  }

  revalidatePath('/[locale]/calendar', 'page');
  return event;
}

/**
 * Updates an existing custom calendar event.
 */
export async function updateCalendarEvent(
  id: string,
  data: {
    title: string;
    description?: string;
    startDate: string;
    endDate?: string;
    isAllDay?: boolean;
    category?: CalendarEventCategory;
    color?: string;
    location?: string;
  }
) {
  const session = await requireAuth();
  const userId = session.user.id;
  const userRole = session.user.role;

  const existing = await db.calendarEvent.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Agenda tidak ditemukan');
  }

  if (existing.creatorId !== userId && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
    throw new Error('Anda tidak memiliki izin mengubah agenda ini');
  }

  const updated = await db.calendarEvent.update({
    where: { id },
    data: {
      title: data.title.trim(),
      description: data.description?.trim() || null,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      isAllDay: data.isAllDay ?? false,
      category: data.category || existing.category,
      color: data.color || existing.color,
      location: data.location?.trim() || null,
    },
  });

  revalidatePath('/[locale]/calendar', 'page');
  return updated;
}

/**
 * Deletes a custom calendar event.
 */
export async function deleteCalendarEvent(id: string) {
  const session = await requireAuth();
  const userId = session.user.id;
  const userRole = session.user.role;

  const existing = await db.calendarEvent.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Agenda tidak ditemukan');
  }

  if (existing.creatorId !== userId && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
    throw new Error('Anda tidak memiliki izin menghapus agenda ini');
  }

  const deleted = await db.calendarEvent.delete({
    where: { id },
  });

  revalidatePath('/[locale]/calendar', 'page');
  return deleted;
}

/**
 * Generates an RFC 5545 iCalendar (.ics) string for export.
 */
export async function exportCalendarIcs(events: CalendarItem[]): Promise<string> {
  const formatDateToIcs = (dateStr: string, isAllDay: boolean) => {
    const d = new Date(dateStr);
    if (isAllDay) {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `VALUE=DATE:${year}${month}${day}`;
    }
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const escapeIcs = (text: string) => {
    return (text || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  const nowIcs = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LenteraBelajar LMS//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:LenteraBelajar Kalender',
    'X-WR-TIMEZONE:Asia/Jakarta',
  ];

  for (const ev of events) {
    const dtStart = formatDateToIcs(ev.startDate, ev.isAllDay);
    const dtEnd = ev.endDate
      ? formatDateToIcs(ev.endDate, ev.isAllDay)
      : dtStart;

    ics.push('BEGIN:VEVENT');
    ics.push(`UID:${ev.id}@lenterabelajar.id`);
    ics.push(`DTSTAMP:${nowIcs}`);
    ics.push(`DTSTART${ev.isAllDay ? ';' : ':'}${dtStart}`);
    ics.push(`DTEND${ev.isAllDay ? ';' : ':'}${dtEnd}`);
    ics.push(`SUMMARY:${escapeIcs(ev.title)}`);
    if (ev.description) {
      ics.push(`DESCRIPTION:${escapeIcs(ev.description)}`);
    }
    if (ev.location || ev.courseTitle) {
      ics.push(`LOCATION:${escapeIcs(ev.location || ev.courseTitle || '')}`);
    }
    ics.push('STATUS:CONFIRMED');
    ics.push('END:VEVENT');
  }

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}
