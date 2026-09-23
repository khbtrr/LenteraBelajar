import { getSchoolAnnouncements } from '@/lib/actions/school-announcement';
import { requireSchool } from '@/lib/auth-utils';
import { AdminAnnouncementsClient } from './client';
import { getTranslations } from 'next-intl/server';

export default async function AdminAnnouncementsPage() {
  const session = await requireSchool();
  const t = await getTranslations('adminAnnouncements');
  const announcements = await getSchoolAnnouncements();

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

      <AdminAnnouncementsClient key={session.schoolId} initialAnnouncements={announcements} />
    </div>
  );
}
