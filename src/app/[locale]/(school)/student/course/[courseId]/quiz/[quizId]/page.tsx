import { notFound } from 'next/navigation';
import { getQuizById, startOrGetQuizAttempt } from '@/lib/actions/quiz';
import { StudentQuizClient } from './client';

export default async function StudentQuizPage({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string }>;
}) {
  const { courseId, quizId } = await params;

  try {
    const quizData = await startOrGetQuizAttempt(quizId);

    return (
      <StudentQuizClient
        courseId={courseId}
        quizId={quizId}
        initialAttempt={quizData.attempt}
        quizTitle={quizData.quizTitle}
        durationMinutes={quizData.durationMinutes}
        questions={quizData.questions}
      />
    );
  } catch (err: any) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <h2 className="text-lg font-bold">Kuis Tidak Tersedia</h2>
          <p className="text-sm mt-1">{err.message || 'Terjadi kesalahan'}</p>
        </div>
      </div>
    );
  }
}
