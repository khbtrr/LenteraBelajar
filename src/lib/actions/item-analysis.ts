'use server';

import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-utils';
import { assertItemAccess } from '@/lib/access';
import { loadQuizAnalysis, analyzeQuestion } from '@/lib/quiz-analysis';

export interface OptionStat {
  id: string;
  text: string;
  isCorrect: boolean;
  count: number;
  percentage: number;
}

export interface QuestionAnalysisItem {
  id: string;
  order: number;
  type: 'MULTIPLE_CHOICE' | 'MULTIPLE_CHOICE_COMPLEX' | 'ESSAY';
  text: string;
  points: number;
  totalAttempts: number;
  correctCount: number;
  incorrectCount: number;
  // Difficulty Index P = Total Correct / Total Participants
  difficultyIndex: number;
  difficultyLabel: 'Mudah' | 'Sedang' | 'Sukar';
  // Discrimination Index D = (Top Correct - Bottom Correct) / N_group
  discriminationIndex: number;
  discriminationLabel: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Jelek / Revisi';
  recommendation: string;
  optionsStats: OptionStat[];
  essayScoresSummary?: {
    averageScore: number;
    highestScore: number;
    lowestScore: number;
  };
}

export interface ItemAnalysisReport {
  quiz: {
    id: string;
    title: string;
    courseId: string;
    courseTitle: string;
    passingGrade: number | null;
  };
  totalParticipants: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passedCount: number;
  failedCount: number;
  passPercentage: number;
  questions: QuestionAnalysisItem[];
}

export async function getItemAnalysisData(quizId: string): Promise<ItemAnalysisReport | null> {
  const { session } = await assertItemAccess('QUIZ', quizId);
  if (session.user.role === 'STUDENT') throw new Error('Akses ditolak: Analisis khusus pengajar dan pengawas');
  const source = await loadQuizAnalysis(quizId);
  const scores = source.attempts.map((attempt) => attempt.score!);
  const passedCount = scores.filter((score) => score >= (source.quiz.passingGrade ?? 75)).length;
  return {
    quiz: { id: source.quiz.id, title: source.quiz.title, courseId: source.quiz.module.courseId,
      courseTitle: source.quiz.module.course.title, passingGrade: source.quiz.passingGrade },
    totalParticipants: scores.length, averageScore: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0,
    highestScore: scores.length ? Math.max(...scores) : 0, lowestScore: scores.length ? Math.min(...scores) : 0,
    passedCount, failedCount: scores.length - passedCount, passPercentage: scores.length ? Math.round(passedCount / scores.length * 100) : 0,
    questions: [...source.questions].map(([version, question], index) => analyzeQuestion(source, version, question, index + 1)),
  };
}
