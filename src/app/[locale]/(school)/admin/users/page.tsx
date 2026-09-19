import { getUsersInSchool } from '@/lib/actions/user';
import { AdminUsersClient } from './client';
import { getTranslations } from 'next-intl/server';

export default async function AdminUsersPage() {
  const t = await getTranslations('adminUsers');
  const users = await getUsersInSchool();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">{t('pageTitle')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('pageDesc')}
        </p>
      </div>

      <AdminUsersClient initialUsers={users} />
    </div>
  );
}
