'use server';

import * as notifications from '@/lib/notifications';
export type { UpcomingDeadlineItem } from '@/lib/notifications';

export async function getUserNotifications() { return notifications.getUserNotifications(); }
export async function getAllUserNotifications(filter?: Parameters<typeof notifications.getAllUserNotifications>[0]) {
  return notifications.getAllUserNotifications(filter);
}
export async function getUnreadNotificationCount() { return notifications.getUnreadNotificationCount(); }
export async function markNotificationAsRead(id: string) { return notifications.markNotificationAsRead(id); }
export async function markAllNotificationsAsRead() { return notifications.markAllNotificationsAsRead(); }
export async function deleteNotification(id: string) { return notifications.deleteNotification(id); }
export async function clearReadNotifications() { return notifications.clearReadNotifications(); }
export async function getStudentUpcomingDeadlines() { return notifications.getStudentUpcomingDeadlines(); }
