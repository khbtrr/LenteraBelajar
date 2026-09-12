import { getTeacherCourseRequests } from '@/lib/actions/course';
import { getAcademicYears } from '@/lib/actions/academic-year';
import { getCategories } from '@/lib/actions/category';
import { TeacherRequestCourseClient } from './client';

export default async function TeacherRequestCoursePage() {
  const [requests, academicYears, categories] = await Promise.all([
    getTeacherCourseRequests(),
    getAcademicYears(),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ajukan Pembuatan Course</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Kirim permohonan pembuatan course baru kepada administrator sekolah untuk disetujui.
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
