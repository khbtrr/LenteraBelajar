import { notFound } from 'next/navigation';
import { getCourseById } from '@/lib/actions/course';
import { getCohorts, getStudentsInSchool } from '@/lib/actions/cohort';
import { CourseEnrollmentsClient } from './client';
import { getTranslations } from 'next-intl/server';

export default async function CourseEnrollmentsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = await getCourseById(courseId);

  if (!course) {
    notFound();
  }

  const [cohorts, students, t] = await Promise.all([
    getCohorts(),
    getStudentsInSchool(),
    getTranslations('teacherEnrollments'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold text-[#FF8928] uppercase tracking-wider">
          {course.category?.name || t('courseFallback')} • {course.academicYear.name}
        </div>
        <h1 className="text-2xl font-bold text-[#002446]">
          {t('headerTitle', { title: course.title })}
        </h1>
        <p className="text-sm text-gray-500">
          {t('headerDesc')}
        </p>
      </div>

      <CourseEnrollmentsClient
        course={course}
        availableCohorts={cohorts}
        availableStudents={students}
      />
    </div>
  );
}
