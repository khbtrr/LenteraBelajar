import { notFound } from 'next/navigation';
import { getCourseById } from '@/lib/actions/course';
import { getCourseModules } from '@/lib/actions/module';
import { getCourseAnnouncements } from '@/lib/actions/announcement';
import { getCourseForumThreads } from '@/lib/actions/forum';
import { StudentCourseForumClient } from './client';

export default async function StudentCourseForumPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ threadId?: string; moduleId?: string }>;
}) {
  const { courseId } = await params;
  const { threadId, moduleId } = await searchParams;

  const [course, modules, announcements, threads] = await Promise.all([
    getCourseById(courseId),
    getCourseModules(courseId),
    getCourseAnnouncements(courseId),
    getCourseForumThreads(courseId),
  ]);

  if (!course) {
    notFound();
  }

  return (
    <StudentCourseForumClient
      course={course}
      modules={modules}
      initialAnnouncements={announcements}
      initialThreads={threads}
      initialThreadId={threadId}
      initialModuleId={moduleId}
    />
  );
}
