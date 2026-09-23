import { requireSchool } from '@/lib/auth-utils';
import { getAdminDashboardData } from '@/lib/actions/admin-analytics';
import { AdminDashboardClient } from './client';

export default async function AdminDashboard() {
  const session = await requireSchool();
  const data = await getAdminDashboardData();

  return (
    <AdminDashboardClient
      key={session.schoolId}
      initialData={data}
      adminName={session?.user?.name || 'Administrator'}
    />
  );
}
