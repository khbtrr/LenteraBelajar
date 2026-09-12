import { notFound } from 'next/navigation';
import { getCourseById } from '@/lib/actions/course';
import { getStudentAttendanceOverview, getCourseAttendanceSessions } from '@/lib/actions/attendance';
import { StudentAttendanceClient } from './client';

export default async function StudentCourseAttendancePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, overview, sessions] = await Promise.all([
    getCourseById(courseId),
    getStudentAttendanceOverview(courseId),
    getCourseAttendanceSessions(courseId),
  ]);

  if (!course) {
    notFound();
  }

  // Find if there is an active session right now
  const activeSession = sessions.find((s) => s.isOpen && s.allowSelfCheckin) || null;

  return (
    <div className="space-y-6">
      <StudentAttendanceClient
        course={course}
        overview={overview}
        activeSession={activeSession}
      />
    </div>
  );
}
