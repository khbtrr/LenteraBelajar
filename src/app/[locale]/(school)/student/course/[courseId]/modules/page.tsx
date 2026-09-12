import { notFound } from 'next/navigation';
import { getCourseById } from '@/lib/actions/course';
import { getCourseModules } from '@/lib/actions/module';
import { getQuizStatusForStudent } from '@/lib/actions/quiz';
import { getPinnedAnnouncement } from '@/lib/actions/announcement';
import { getCourseAttendanceSessions } from '@/lib/actions/attendance';
import { StudentCourseModulesClient } from './client';

export default async function StudentCourseModulesPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, modules, pinnedAnnouncement, sessions] = await Promise.all([
    getCourseById(courseId),
    getCourseModules(courseId),
    getPinnedAnnouncement(courseId),
    getCourseAttendanceSessions(courseId),
  ]);

  if (!course) {
    notFound();
  }

  const activeSession = sessions.find((s) => s.isOpen && s.allowSelfCheckin) || null;

  // Fetch quiz statuses for all quizzes across all modules
  const quizStatusMap: Record<string, any> = {};
  const allQuizzes = modules.flatMap((m: any) => m.quizzes || []);
  await Promise.all(
    allQuizzes.map(async (quiz: any) => {
      try {
        const status = await getQuizStatusForStudent(quiz.id);
        quizStatusMap[quiz.id] = status;
      } catch {
        quizStatusMap[quiz.id] = null;
      }
    })
  );

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

      <StudentCourseModulesClient
        course={course}
        modules={modules}
        quizStatusMap={quizStatusMap}
        pinnedAnnouncement={pinnedAnnouncement}
        activeSession={activeSession}
      />
    </div>
  );
}
