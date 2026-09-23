import { getAcademicYears } from '@/lib/actions/academic-year';
import { requireSchool } from '@/lib/auth-utils';
import { AcademicYearsClient } from './client';
import { getTranslations } from 'next-intl/server';

export default async function AcademicYearsPage() {
  const session = await requireSchool();
  const t = await getTranslations('adminAcademicYears');
  const academicYears = await getAcademicYears();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">{t('pageTitle')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('pageDesc')}
        </p>
      </div>

      <AcademicYearsClient key={session.schoolId} initialYears={academicYears} />
    </div>
  );
}
