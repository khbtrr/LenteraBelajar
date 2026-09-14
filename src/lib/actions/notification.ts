'use server';

import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';

export async function getUserNotifications() {
  const session = await requireAuth();
  return db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

export async function getAllUserNotifications(filter?: {
  category?: 'ALL' | 'UNREAD' | 'ASSIGNMENT_QUIZ' | 'GRADE' | 'ANNOUNCEMENT_FORUM';
}) {
  const session = await requireAuth();

  const where: any = {
    userId: session.user.id,
  };

  if (filter?.category === 'UNREAD') {
    where.isRead = false;
  } else if (filter?.category === 'ASSIGNMENT_QUIZ') {
    where.type = { in: ['ASSIGNMENT', 'QUIZ', 'REMEDIAL', 'DEADLINE'] };
  } else if (filter?.category === 'GRADE') {
    where.type = { in: ['GRADE', 'SUBMISSION'] };
  } else if (filter?.category === 'ANNOUNCEMENT_FORUM') {
    where.type = { in: ['ANNOUNCEMENT', 'FORUM'] };
  }

  return db.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function getUnreadNotificationCount() {
  const session = await requireAuth();
  return db.notification.count({
    where: { userId: session.user.id, isRead: false },
  });
}

export async function markNotificationAsRead(id: string) {
  const session = await requireAuth();
  const notif = await db.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { isRead: true },
  });
  revalidatePath('/', 'layout');
  return notif;
}

export async function markAllNotificationsAsRead() {
  const session = await requireAuth();
  const res = await db.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });
  revalidatePath('/', 'layout');
  return res;
}

export async function deleteNotification(id: string) {
  const session = await requireAuth();
  const res = await db.notification.deleteMany({
    where: { id, userId: session.user.id },
  });
  revalidatePath('/', 'layout');
  return res;
}

export async function clearReadNotifications() {
  const session = await requireAuth();
  const res = await db.notification.deleteMany({
    where: { userId: session.user.id, isRead: true },
  });
  revalidatePath('/', 'layout');
  return res;
}

export async function createNotification(data: {
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string;
}) {
  return db.notification.create({
    data: {
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type,
      link: data.link,
    },
  });
}

export async function createBulkNotifications(
  userIds: string[],
  data: {
    title: string;
    message: string;
    type: string;
    link?: string;
  }
) {
  if (!userIds || userIds.length === 0) return;
  const uniqueUserIds = Array.from(new Set(userIds));

  return db.notification.createMany({
    data: uniqueUserIds.map((userId) => ({
      userId,
      title: data.title,
      message: data.message,
      type: data.type,
      link: data.link,
    })),
  });
}

export interface UpcomingDeadlineItem {
  id: string;
  type: 'QUIZ' | 'ASSIGNMENT';
  title: string;
  courseId: string;
  courseTitle: string;
  deadline: Date;
  hoursLeft: number;
  isUrgent: boolean; // < 24 hours
  link: string;
}

export async function getStudentUpcomingDeadlines(): Promise<UpcomingDeadlineItem[]> {
  const session = await requireAuth();
  if (session.user.role !== 'STUDENT') return [];

  const now = new Date();
  const next48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // Find enrolled course IDs
  const enrollments = await db.enrollment.findMany({
    where: { userId: session.user.id },
    select: { courseId: true },
  });

  const courseIds = enrollments.map((e) => e.courseId);
  if (courseIds.length === 0) return [];

  // 1. Quizzes with deadline in [now, next48Hours] that student hasn't submitted
  const quizzes = await db.quiz.findMany({
    where: {
      module: { courseId: { in: courseIds } },
      isPublished: true,
      deadline: {
        gte: now,
        lte: next48Hours,
      },
      attempts: {
        none: {
          userId: session.user.id,
          submittedAt: { not: null },
        },
      },
    },
    include: {
      module: {
        include: {
          course: {
            select: { id: true, title: true },
          },
        },
      },
    },
  });

  // 2. Assignments with deadline in [now, next48Hours] that student hasn't submitted
  const assignments = await db.assignment.findMany({
    where: {
      module: { courseId: { in: courseIds } },
      deadline: {
        gte: now,
        lte: next48Hours,
      },
      submissions: {
        none: {
          userId: session.user.id,
        },
      },
    },
    include: {
      module: {
        include: {
          course: {
            select: { id: true, title: true },
          },
        },
      },
    },
  });

  const items: UpcomingDeadlineItem[] = [];

  for (const q of quizzes) {
    if (!q.deadline) continue;
    const diffMs = new Date(q.deadline).getTime() - now.getTime();
    const hoursLeft = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));

    items.push({
      id: q.id,
      type: 'QUIZ',
      title: q.title,
      courseId: q.module.course.id,
      courseTitle: q.module.course.title,
      deadline: q.deadline,
      hoursLeft,
      isUrgent: hoursLeft <= 24,
      link: `/student/course/${q.module.course.id}/quiz/${q.id}`,
    });
  }

  for (const a of assignments) {
    if (!a.deadline) continue;
    const diffMs = new Date(a.deadline).getTime() - now.getTime();
    const hoursLeft = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));

    items.push({
      id: a.id,
      type: 'ASSIGNMENT',
      title: a.title,
      courseId: a.module.course.id,
      courseTitle: a.module.course.title,
      deadline: a.deadline,
      hoursLeft,
      isUrgent: hoursLeft <= 24,
      link: `/student/course/${a.module.course.id}/assignment/${a.id}`,
    });
  }

  // Sort by deadline ascending (most urgent first)
  items.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  return items;
}
