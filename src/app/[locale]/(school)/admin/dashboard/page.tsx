import { requireSchool } from '@/lib/auth-utils';
import { getAdminDashboardData } from '@/lib/actions/admin-analytics';
import { AdminDashboardClient } from './client';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await requireSchool();
  const data = await getAdminDashboardData();

  return (
    <AdminDashboardClient
      key={session.user.schoolId}
      initialData={data}
      adminName={session?.user?.name || 'Administrator'}
    />
  );
}
