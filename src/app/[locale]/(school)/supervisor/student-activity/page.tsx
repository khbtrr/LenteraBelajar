import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getStudentActivityStats } from '@/lib/actions/monitoring';
import { StudentActivityClient } from './client';

export default async function SupervisorStudentActivityPage() {
  const session = await auth();
  if (!session?.user?.schoolId) return null;

  const t = await getTranslations('supervisorStudentActivity');
  const students = await getStudentActivityStats(session.user.schoolId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">{t('title')}</h1>
        <p className="text-sm text-gray-500">
          {t('subtitle')}
        </p>
      </div>

      <StudentActivityClient students={students} />
    </div>
  );
}
