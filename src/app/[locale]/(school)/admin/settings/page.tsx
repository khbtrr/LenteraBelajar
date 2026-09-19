import { getSchoolSettings } from '@/lib/actions/school-settings';
import { AdminSettingsClient } from './client';
import { getTranslations } from 'next-intl/server';

export default async function AdminSettingsPage() {
  const t = await getTranslations('adminSettings');
  const { school, activeAcademicYear, adminUser } = await getSchoolSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">
          {t('pageTitle')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('pageDesc')}
        </p>
      </div>

      <AdminSettingsClient
        initialSchool={school}
        activeAcademicYear={activeAcademicYear}
        adminUser={adminUser}
      />
    </div>
  );
}
