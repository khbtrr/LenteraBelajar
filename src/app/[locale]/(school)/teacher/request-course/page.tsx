import { getTeacherCourseRequests } from '@/lib/actions/course';
import { getAcademicYears } from '@/lib/actions/academic-year';
import { getCategories } from '@/lib/actions/category';
import { TeacherRequestCourseClient } from './client';
import { getTranslations } from 'next-intl/server';

export default async function TeacherRequestCoursePage() {
  const t = await getTranslations('teacherRequestCourse');
  const [requests, academicYears, categories] = await Promise.all([
    getTeacherCourseRequests(),
    getAcademicYears(),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('headerTitle')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('headerDesc')}
        </p>
      </div>

      <TeacherRequestCourseClient
        initialRequests={requests}
        academicYears={academicYears}
        categories={categories}
      />
    </div>
  );
}
