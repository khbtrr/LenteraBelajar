import { auth } from '@/lib/auth';
import { getCourseById } from '@/lib/actions/course';
import { getQuestionBankByCategory, getQuestionBankStats } from '@/lib/actions/question-bank';
import { notFound } from 'next/navigation';
import { QuestionBankClient } from './client';

export default async function QuestionBankPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const [course, bankData, stats] = await Promise.all([
    getCourseById(courseId),
    getQuestionBankByCategory(courseId),
    getQuestionBankStats(courseId),
  ]);
  if (!course) notFound();

  return <QuestionBankClient courseId={courseId} course={course} initialData={bankData} initialStats={stats} />;
}
