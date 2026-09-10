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
