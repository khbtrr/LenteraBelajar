import { requireSchool } from '@/lib/auth-utils';
import { getCourses } from '@/lib/actions/course';
import { getAcademicYears } from '@/lib/actions/academic-year';
import { getCategories } from '@/lib/actions/category';
import { TeacherCoursesClient } from './client';

export default async function TeacherMyCoursesPage() {
  const session = await requireSchool();
  if (!session?.user) return null;

  const [courses, academicYears, categories] = await Promise.all([
    getCourses({ teacherId: session.user.id }),
    getAcademicYears(),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Course Saya</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Daftar mata pelajaran yang Anda ampu pada tahun ajaran aktif maupun arsip.
        </p>
      </div>

      <TeacherCoursesClient
        key={session.schoolId}
        initialCourses={courses}
        academicYears={academicYears}
        categories={categories}
        currentUserId={session.user.id}
      />
    </div>
  );
}
