import { getCourses, getTeachersInSchool } from '@/lib/actions/course';
import { getAcademicYears } from '@/lib/actions/academic-year';
import { getCategories } from '@/lib/actions/category';
import { requireSchool } from '@/lib/auth-utils';
import { AdminCoursesClient } from './client';
import { getTranslations } from 'next-intl/server';

export default async function AdminCoursesPage() {
  const session = await requireSchool();
  const t = await getTranslations('adminCourses');
  const [courses, academicYears, categories, teachers] = await Promise.all([
    getCourses(),
    getAcademicYears(),
    getCategories(),
    getTeachersInSchool(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">{t('pageTitle')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('pageDesc')}
        </p>
      </div>

      <AdminCoursesClient
        key={session.schoolId}
        initialCourses={courses}
        academicYears={academicYears}
        categories={categories}
        teachers={teachers}
      />
    </div>
  );
}
