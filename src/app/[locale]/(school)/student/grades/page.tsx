import { auth } from '@/lib/auth';
import { getStudentGradesOverview } from '@/lib/actions/grade';
import { StudentGradesClient } from './client';
import { getTranslations } from 'next-intl/server';

export default async function StudentGradesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const t = await getTranslations('studentGrades');
  const courses = await getStudentGradesOverview(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">{t('pageTitle')}</h1>
        <p className="text-sm text-gray-500">
          {t('pageSubtitle')}
        </p>
      </div>

      <StudentGradesClient courses={courses} />
    </div>
  );
}

