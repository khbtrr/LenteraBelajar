import { notFound } from 'next/navigation';
import { getQuizById, getQuizStatusForStudent } from '@/lib/actions/quiz';
import { StudentQuizLanding } from './landing';
import { getTranslations } from 'next-intl/server';

export default async function StudentQuizPage({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string }>;
}) {
  const { courseId, quizId } = await params;
  const t = await getTranslations('studentQuiz');

  try {
    const [quiz, status] = await Promise.all([
      getQuizById(quizId),
      getQuizStatusForStudent(quizId),
    ]);

    if (!quiz) notFound();

    return (
      <StudentQuizLanding
        courseId={courseId}
        quiz={quiz}
        status={status}
      />
    );
  } catch (err: any) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <h2 className="text-lg font-bold">{t('notAvailableTitle')}</h2>
          <p className="text-sm mt-1">{err.message || t('defaultError')}</p>
        </div>
      </div>
    );
  }
}

