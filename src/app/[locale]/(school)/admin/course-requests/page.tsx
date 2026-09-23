import { getCourseRequests } from '@/lib/actions/course';
import { requireSchool } from '@/lib/auth-utils';
import { CourseRequestsClient } from './client';
import { getTranslations } from 'next-intl/server';

export default async function AdminCourseRequestsPage() {
  const session = await requireSchool();
  const t = await getTranslations('adminCourseRequests');
  const requests = await getCourseRequests();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">{t('pageTitle')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('pageDesc')}
        </p>
      </div>

      <CourseRequestsClient key={session.schoolId} initialRequests={requests} />
    </div>
  );
}
