import { auth } from '@/lib/auth';
import { getCourseGradebook } from '@/lib/actions/grade';
import { notFound } from 'next/navigation';
import { TeacherGradebookClient } from './client';

export default async function TeacherGradebookPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const data = await getCourseGradebook(courseId);
  if (!data) notFound();

  return <TeacherGradebookClient data={data} />;
}
