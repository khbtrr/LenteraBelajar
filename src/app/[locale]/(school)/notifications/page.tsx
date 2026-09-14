import { auth } from '@/lib/auth';
import { getAllUserNotifications } from '@/lib/actions/notification';
import { NotificationsClient } from './client';

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const initialNotifications = await getAllUserNotifications();

  return <NotificationsClient initialNotifications={initialNotifications} />;
}
