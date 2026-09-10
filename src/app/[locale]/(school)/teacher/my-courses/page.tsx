import { auth } from '@/lib/auth';
import { getCourses } from '@/lib/actions/course';
import { getAcademicYears } from '@/lib/actions/academic-year';
import { getCategories } from '@/lib/actions/category';
import { TeacherCoursesClient } from './client';

export default async function TeacherMyCoursesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [courses, academicYears, categories] = await Promise.all([
    getCourses({ teacherId: session.user.id }),
    getAcademicYears(),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">Course Saya</h1>
        <p className="text-sm text-gray-500">
          Daftar mata pelajaran yang Anda ampu pada tahun ajaran aktif maupun arsip.
        </p>
      </div>

      <TeacherCoursesClient
        initialCourses={courses}
        academicYears={academicYears}
        categories={categories}
        currentUserId={session.user.id}
      />
    </div>
  );
}
