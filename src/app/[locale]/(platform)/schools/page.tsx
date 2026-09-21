import { getTranslations } from 'next-intl/server';
import { getSchools } from '@/lib/actions/school';
import { PlatformSchoolsClient } from './client';

export default async function PlatformSchoolsPage() {
  const t = await getTranslations('schools');
  const schools = await getSchools();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">{t('pageTitle')}</h1>
        <p className="text-sm text-gray-500">
          {t('pageSubtitle')}
        </p>
      </div>

      <PlatformSchoolsClient initialSchools={schools} />
    </div>
  );
}
