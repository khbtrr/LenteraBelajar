import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getCourseById } from '@/lib/actions/course';
import { getCourseModules } from '@/lib/actions/module';
import { getQuizStatusForStudent } from '@/lib/actions/quiz';
import { getPinnedAnnouncement } from '@/lib/actions/announcement';
import { getCourseAttendanceSessions } from '@/lib/actions/attendance';
import { StudentCourseModulesClient } from './client';
import { getTranslations } from 'next-intl/server';

export default async function StudentCourseModulesPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const t = await getTranslations('studentModules');
  const { courseId } = await params;
  const session = await auth();
  const [course, modules, pinnedAnnouncement, sessions, completedLessons] = await Promise.all([
    getCourseById(courseId),
    getCourseModules(courseId),
    getPinnedAnnouncement(courseId),
    getCourseAttendanceSessions(courseId),
    session?.user?.id
      ? db.lessonProgress.findMany({
          where: { userId: session.user.id, courseId },
          select: { contentId: true },
        })
      : Promise.resolve([]),
  ]);

  if (!course) {
    notFound();
  }

  // Determine user's cohorts and overrides for filtering
  const userId = session?.user?.id;
  const isStudent = session?.user?.role === 'STUDENT';

  let filteredModules = modules;
  if (isStudent && userId) {
    const userEnrollment = course.enrollments.find((e: any) => e.user?.id === userId);
    const [userCohortMembers, userOverrides] = await Promise.all([
      db.cohortMember.findMany({
        where: { userId },
        select: { cohortId: true },
      }),
      db.itemAccessOverride.findMany({
        where: { userId },
        select: { itemType: true, itemId: true },
      }),
    ]);

    const userCohortIds = new Set<string>();
    if (userEnrollment?.cohort?.id) {
      userCohortIds.add(userEnrollment.cohort.id);
    }
    for (const cm of userCohortMembers) {
      userCohortIds.add(cm.cohortId);
    }

    const overrideSet = new Set<string>();
    for (const o of userOverrides) {
      overrideSet.add(`${o.itemType}_${o.itemId}`);
    }

    filteredModules = modules.map((mod: any) => ({
      ...mod,
      contents: (mod.contents || []).filter((c: any) => {
        if (!c.cohortAccess || c.cohortAccess.length === 0) return true;
        if (overrideSet.has(`CONTENT_${c.id}`)) return true;
        return c.cohortAccess.some((ca: any) => userCohortIds.has(ca.cohortId));
      }),
      quizzes: (mod.quizzes || []).filter((q: any) => {
        if (!q.cohortAccess || q.cohortAccess.length === 0) return true;
        if (overrideSet.has(`QUIZ_${q.id}`)) return true;
        return q.cohortAccess.some((ca: any) => userCohortIds.has(ca.cohortId));
      }),
      assignments: (mod.assignments || []).filter((a: any) => {
        if (!a.cohortAccess || a.cohortAccess.length === 0) return true;
        if (overrideSet.has(`ASSIGNMENT_${a.id}`)) return true;
        return a.cohortAccess.some((ca: any) => userCohortIds.has(ca.cohortId));
      }),
    }));
  }

  const completedLessonIds = completedLessons.map((l: any) => l.contentId);

  const activeSession = sessions.find((s) => s.isOpen && s.allowSelfCheckin) || null;

  // Fetch quiz statuses only for quizzes accessible to the student
  const quizStatusMap: Record<string, any> = {};
  const allQuizzes = filteredModules.flatMap((m: any) => m.quizzes || []);
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
          {course.category?.name || t('defaultCategory')} • {course.academicYear.name}
        </div>
        <h1 className="text-2xl font-bold text-[#002446]">
          {course.title}
        </h1>
        <p className="text-sm text-gray-500">
          {t('teacherLabel')} <strong>{course.teacher.name}</strong>
        </p>
      </div>

      <StudentCourseModulesClient
        course={course}
        modules={filteredModules}
        quizStatusMap={quizStatusMap}
        pinnedAnnouncement={pinnedAnnouncement}
        activeSession={activeSession}
        completedLessonIds={completedLessonIds}
      />
    </div>
  );
}
