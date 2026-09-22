import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getCourseById } from '@/lib/actions/course';
import { getCourseModules } from '@/lib/actions/module';
import { TeacherCourseModulesClient } from './client';

export default async function TeacherCourseModulesPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await auth();
  const [course, modules] = await Promise.all([
    getCourseById(courseId),
    getCourseModules(courseId),
  ]);

  if (!course) {
    notFound();
  }

  const isReadOnly = session?.user?.role === 'SUPERVISOR';

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold text-[#FF8928] uppercase tracking-wider">
          {course.category?.name || 'Mata Pelajaran'} • {course.academicYear.name}
        </div>
        <h1 className="text-2xl font-bold text-[#002446]">
          Manajemen Modul & Pembelajaran: {course.title}
        </h1>
        <p className="text-sm text-gray-500">
          Kelola bab modul materi, unggah dokumen / video, buat kuis (pilihan ganda & essay), serta penugasan siswa.
        </p>
      </div>

      <TeacherCourseModulesClient
        course={course}
        initialModules={modules}
        isReadOnly={isReadOnly}
      />
    </div>
  );
}
