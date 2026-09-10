import { notFound } from 'next/navigation';
import { getCourseById } from '@/lib/actions/course';
import { getCourseModules } from '@/lib/actions/module';
import { StudentCourseModulesClient } from './client';

export default async function StudentCourseModulesPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, modules] = await Promise.all([
    getCourseById(courseId),
    getCourseModules(courseId),
  ]);

  if (!course) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold text-[#FF8928] uppercase tracking-wider">
          {course.category?.name || 'Mata Pelajaran'} • {course.academicYear.name}
        </div>
        <h1 className="text-2xl font-bold text-[#002446]">
          {course.title}
        </h1>
        <p className="text-sm text-gray-500">
          Guru Pengampu: <strong>{course.teacher.name}</strong>
        </p>
      </div>

      <StudentCourseModulesClient course={course} modules={modules} />
    </div>
  );
}
