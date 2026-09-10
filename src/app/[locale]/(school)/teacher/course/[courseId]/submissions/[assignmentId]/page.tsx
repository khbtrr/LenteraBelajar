import { auth } from '@/lib/auth';
import { getAssignmentSubmissionsList } from '@/lib/actions/grade';
import { notFound } from 'next/navigation';
import { TeacherSubmissionsClient } from './client';

export default async function TeacherSubmissionsPage({
  params,
}: {
  params: Promise<{ courseId: string; assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const data = await getAssignmentSubmissionsList(assignmentId);
  if (!data) notFound();

  return <TeacherSubmissionsClient data={data} />;
}
