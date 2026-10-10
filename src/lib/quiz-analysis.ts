import 'server-only';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { readSnapshot, parseSelectedOptions, type SnapshotQuestion } from '@/lib/grading-policy';
import type { QuestionAnalysisItem } from '@/lib/actions/item-analysis';

export function questionVersion(question: SnapshotQuestion) {
  const key = { id: question.id, type: question.type, text: question.text, points: question.points,
    options: question._correctData ? [...question._correctData].sort((a, b) => a.id.localeCompare(b.id)) : null };
  return `${question.id}@${createHash('sha256').update(JSON.stringify(key)).digest('hex').slice(0, 12)}`;
}

export async function loadQuizAnalysis(quizId: string) {
  const quiz = await db.quiz.findUniqueOrThrow({ where: { id: quizId }, include: {
    module: { include: { course: true } }, questions: { orderBy: { order: 'asc' } },
    attempts: { where: { submittedAt: { not: null }, isGraded: true, isVoided: false, score: { not: null } },
      include: { answers: true, user: { select: { id: true, name: true, email: true, nis: true } } }, orderBy: { score: 'desc' } },
  } });
  const participants = new Set<string>();
  const attempts = quiz.attempts.filter((attempt) => {
    if (participants.has(attempt.userId)) return false;
    participants.add(attempt.userId); return true;
  });
  const snapshots = new Map<string, SnapshotQuestion[]>();
  const questions = new Map<string, SnapshotQuestion>();
  for (const attempt of attempts) {
    if (!Array.isArray(attempt.questionSnapshot) || !attempt.questionSnapshot.length) continue;
    try {
      const snapshot = readSnapshot(attempt.questionSnapshot);
      snapshots.set(attempt.id, snapshot);
      for (const question of snapshot) questions.set(questionVersion(question), question);
    } catch {}
  }
  if (!questions.size && quiz.questions.length) for (const question of readSnapshot(quiz.questions)) questions.set(questionVersion(question), question);
  return { quiz, attempts, snapshots, questions };
}

export function analyzeQuestion(source: Awaited<ReturnType<typeof loadQuizAnalysis>>, version: string, question: SnapshotQuestion, order: number): QuestionAnalysisItem {
  const exposed = source.attempts.filter((attempt) => source.snapshots.get(attempt.id)?.some((item) => questionVersion(item) === version));
  const answers = exposed.map((attempt) => attempt.answers.find((answer) => answer.questionId === question.id));
  const isCorrect = (answer: (typeof answers)[0]) => Boolean(answer && answer.score !== null && answer.score >= question.points * (question.type === 'ESSAY' ? 0.6 : 1));
  const correctCount = answers.filter(isCorrect).length;
  const difficultyIndex = exposed.length ? correctCount / exposed.length : 0;
  const groupSize = Math.max(1, Math.round(exposed.length * 0.27));
  const discriminationIndex = exposed.length < 2 ? 0 : (answers.slice(0, groupSize).filter(isCorrect).length - answers.slice(-groupSize).filter(isCorrect).length) / groupSize;
  const optionsStats = (question._correctData ?? []).map((option) => {
    const count = answers.filter((answer) => parseSelectedOptions(answer?.answer ?? '').includes(option.id.trim().toUpperCase())).length;
    return { ...option, count, percentage: exposed.length ? Math.round(count / exposed.length * 100) : 0 };
  });
  const essayScores = answers.map((answer) => answer?.score).filter((score): score is number => score !== null && score !== undefined);
  return {
    id: version, order, type: question.type, text: question.text, points: question.points,
    totalAttempts: exposed.length, correctCount, incorrectCount: exposed.length - correctCount,
    difficultyIndex, difficultyLabel: difficultyIndex > 0.7 ? 'Mudah' : difficultyIndex < 0.3 ? 'Sukar' : 'Sedang',
    discriminationIndex, discriminationLabel: discriminationIndex >= 0.4 ? 'Sangat Baik' : discriminationIndex >= 0.3 ? 'Baik' : discriminationIndex >= 0.2 ? 'Cukup' : 'Jelek / Revisi',
    recommendation: exposed.length < 2 ? 'Data belum cukup untuk menilai daya pembeda.' : discriminationIndex < 0.2 ? 'Tinjau rubrik, kunci, dan pengecoh soal.' : 'Soal membedakan hasil peserta yang mengerjakannya.',
    optionsStats,
    ...(question.type === 'ESSAY' ? { essayScoresSummary: { averageScore: essayScores.length ? essayScores.reduce((sum, value) => sum + value, 0) / essayScores.length : 0,
      highestScore: essayScores.length ? Math.max(...essayScores) : 0, lowestScore: essayScores.length ? Math.min(...essayScores) : 0 } } : {}),
  };
}
