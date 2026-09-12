import { notFound } from 'next/navigation';
import { getLiveProctorData } from '@/lib/actions/proctor';
import { TeacherLiveProctorClient } from './client';

export default async function TeacherLiveProctorPage({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string }>;
}) {
  const { courseId, quizId } = await params;

  try {
    const data = await getLiveProctorData(quizId);
    return <TeacherLiveProctorClient initialData={data} courseId={courseId} quizId={quizId} />;
  } catch (err: any) {
    console.error(err);
    notFound();
  }
}
