import { auth } from '@/lib/auth';
import { getAdminDashboardData } from '@/lib/actions/admin-analytics';
import { AdminDashboardClient } from './client';

export default async function AdminDashboard() {
  const session = await auth();
  const data = await getAdminDashboardData();

  return (
    <AdminDashboardClient
      initialData={data}
      adminName={session?.user?.name || 'Administrator'}
    />
  );
}
