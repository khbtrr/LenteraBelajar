import { getCohorts, getStudentsInSchool, getAvailableTeachersForCohort } from '@/lib/actions/cohort';
import { requireSchool } from '@/lib/auth-utils';
import { CohortsClient } from './client';
import { getTranslations } from 'next-intl/server';

export default async function AdminCohortsPage() {
  const session = await requireSchool();
  const t = await getTranslations('adminCohorts');
  const [cohorts, students, teachers] = await Promise.all([
    getCohorts(),
    getStudentsInSchool(),
    getAvailableTeachersForCohort(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">{t('pageTitle')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('pageDesc')}
        </p>
      </div>

      <CohortsClient
        key={session.schoolId}
        initialCohorts={cohorts}
        availableStudents={students}
        availableTeachers={teachers}
      />
    </div>
  );
}
