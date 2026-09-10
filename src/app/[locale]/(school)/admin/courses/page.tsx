import { getCourses, getTeachersInSchool } from '@/lib/actions/course';
import { getAcademicYears } from '@/lib/actions/academic-year';
import { getCategories } from '@/lib/actions/category';
import { AdminCoursesClient } from './client';

export default async function AdminCoursesPage() {
  const [courses, academicYears, categories, teachers] = await Promise.all([
    getCourses(),
    getAcademicYears(),
    getCategories(),
    getTeachersInSchool(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">Manajemen Course</h1>
        <p className="text-sm text-gray-500">
          Daftar seluruh mata pelajaran / course yang diselenggarakan di sekolah.
        </p>
      </div>

      <AdminCoursesClient
        initialCourses={courses}
        academicYears={academicYears}
        categories={categories}
        teachers={teachers}
      />
    </div>
  );
}
