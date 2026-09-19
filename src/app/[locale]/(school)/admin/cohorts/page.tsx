import { getCohorts, getStudentsInSchool } from '@/lib/actions/cohort';
import { CohortsClient } from './client';
import { getTranslations } from 'next-intl/server';

export default async function AdminCohortsPage() {
  const t = await getTranslations('adminCohorts');
  const [cohorts, students] = await Promise.all([
    getCohorts(),
    getStudentsInSchool(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">{t('pageTitle')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('pageDesc')}
        </p>
      </div>

      <CohortsClient initialCohorts={cohorts} availableStudents={students} />
    </div>
  );
}
