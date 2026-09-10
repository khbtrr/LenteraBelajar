import { notFound } from 'next/navigation';
import { getAssignmentById } from '@/lib/actions/assignment';
import { StudentAssignmentClient } from './client';

export default async function StudentAssignmentPage({
  params,
}: {
  params: Promise<{ courseId: string; assignmentId: string }>;
}) {
  const { courseId, assignmentId } = await params;
  const assignment = await getAssignmentById(assignmentId);

  if (!assignment) {
    notFound();
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-16">
      <StudentAssignmentClient courseId={courseId} assignment={assignment} />
    </div>
  );
}
