import { auth } from '@/lib/auth';
import { getQuizAttemptsList } from '@/lib/actions/grade';
import { getItemAnalysisData } from '@/lib/actions/item-analysis';
import { getRemedialEligibleData } from '@/lib/actions/remedial';
import { notFound } from 'next/navigation';
import { TeacherQuizAttemptsClient } from './client';

export default async function TeacherQuizAttemptsPage({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string }>;
}) {
  const { quizId } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const [data, analysisData, remedialData] = await Promise.all([
    getQuizAttemptsList(quizId),
    getItemAnalysisData(quizId),
    getRemedialEligibleData(quizId),
  ]);

  if (!data) notFound();

  return (
    <TeacherQuizAttemptsClient
      data={data}
      analysisData={analysisData}
      remedialData={remedialData}
    />
  );
}
