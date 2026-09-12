import { notFound } from 'next/navigation';
import { getCourseById } from '@/lib/actions/course';
import { getCourseModules } from '@/lib/actions/module';
import { getCourseAttendanceSessions, getCourseAttendanceRecap } from '@/lib/actions/attendance';
import { TeacherAttendanceClient } from './client';

export default async function TeacherCourseAttendancePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, modules, sessions, recap] = await Promise.all([
    getCourseById(courseId),
    getCourseModules(courseId),
    getCourseAttendanceSessions(courseId),
    getCourseAttendanceRecap(courseId),
  ]);

  if (!course) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <TeacherAttendanceClient
        course={course}
        modules={modules}
        initialSessions={sessions}
        recapData={recap}
      />
    </div>
  );
}
