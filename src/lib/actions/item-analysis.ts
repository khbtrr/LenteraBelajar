'use server';

import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-utils';

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
  const session = await requireAuth();

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      module: {
        include: { course: true },
      },
      questions: {
        orderBy: { order: 'asc' },
      },
      attempts: {
        where: { submittedAt: { not: null } },
        include: {
          user: {
            select: { id: true, name: true, nis: true, email: true },
          },
          answers: true,
        },
        orderBy: { score: 'desc' },
      },
    },
  });

  if (!quiz) return null;

  // Filter valid attempts with scores
  const attempts = quiz.attempts.filter((a) => a.score !== null);
  const totalParticipants = attempts.length;

  if (totalParticipants === 0) {
    return {
      quiz: {
        id: quiz.id,
        title: quiz.title,
        courseId: quiz.module.courseId,
        courseTitle: quiz.module.course.title,
        passingGrade: quiz.passingGrade,
      },
      totalParticipants: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      passedCount: 0,
      failedCount: 0,
      passPercentage: 0,
      questions: quiz.questions.map((q, idx) => ({
        id: q.id,
        order: idx + 1,
        type: q.type as 'MULTIPLE_CHOICE' | 'MULTIPLE_CHOICE_COMPLEX' | 'ESSAY',
        text: q.text,
        points: q.points,
        totalAttempts: 0,
        correctCount: 0,
        incorrectCount: 0,
        difficultyIndex: 0,
        difficultyLabel: 'Sedang',
        discriminationIndex: 0,
        discriminationLabel: 'Cukup',
        recommendation: 'Belum ada data pengerjaan siswa',
        optionsStats: [],
      })),
    };
  }

  // Summary statistics
  const scores = attempts.map((a) => a.score as number);
  const highestScore = Math.max(...scores);
  const lowestScore = Math.min(...scores);
  const averageScore = Math.round((scores.reduce((sum, s) => sum + s, 0) / totalParticipants) * 10) / 10;
  
  const passingGrade = quiz.passingGrade ?? 75;
  const passedCount = scores.filter((s) => s >= passingGrade).length;
  const failedCount = totalParticipants - passedCount;
  const passPercentage = Math.round((passedCount / totalParticipants) * 100);

  // Divide into upper (Top 27%) and lower (Bottom 27%) groups for Discrimination Index
  const groupSize = Math.max(1, Math.round(totalParticipants * 0.27));
  const topGroup = attempts.slice(0, groupSize);
  const bottomGroup = attempts.slice(Math.max(groupSize, totalParticipants - groupSize));

  const questionsAnalysis: QuestionAnalysisItem[] = quiz.questions.map((question, idx) => {
    const rawOptions = (question.options as any[]) || [];

    if (question.type === 'MULTIPLE_CHOICE' || question.type === 'MULTIPLE_CHOICE_COMPLEX') {
      // Find correct option
      const correctOption = rawOptions.find((opt) => opt.isCorrect);
      const correctOptionId = correctOption?.id;

      // Count answer frequencies
      const optionFrequencyMap: Record<string, number> = {};
      rawOptions.forEach((opt) => {
        optionFrequencyMap[opt.id] = 0;
      });

      let correctCount = 0;

      attempts.forEach((att) => {
        const studentAns = att.answers.find((ans) => ans.questionId === question.id);
        if (studentAns && studentAns.answer) {
          const chosen = studentAns.answer.split(',').map((s) => s.trim());
          chosen.forEach((c) => {
            if (optionFrequencyMap[c] !== undefined) {
              optionFrequencyMap[c] += 1;
            }
          });
          if (studentAns.score && studentAns.score > 0) {
            correctCount += 1;
          } else if (question.type === 'MULTIPLE_CHOICE' && studentAns.answer === correctOptionId) {
            correctCount += 1;
          }
        }
      });

      const incorrectCount = totalParticipants - correctCount;

      // 1. Difficulty Index (P)
      const difficultyIndex = Math.round((correctCount / totalParticipants) * 100) / 100;
      let difficultyLabel: 'Mudah' | 'Sedang' | 'Sukar' = 'Sedang';
      if (difficultyIndex > 0.7) difficultyLabel = 'Mudah';
      else if (difficultyIndex < 0.3) difficultyLabel = 'Sukar';

      // 2. Discrimination Index (D)
      let topCorrect = 0;
      topGroup.forEach((att) => {
        const studentAns = att.answers.find((ans) => ans.questionId === question.id);
        if (studentAns?.answer === correctOptionId || (studentAns?.score && studentAns.score > 0)) {
          topCorrect += 1;
        }
      });

      let bottomCorrect = 0;
      bottomGroup.forEach((att) => {
        const studentAns = att.answers.find((ans) => ans.questionId === question.id);
        if (studentAns?.answer === correctOptionId || (studentAns?.score && studentAns.score > 0)) {
          bottomCorrect += 1;
        }
      });

      const discriminationIndex =
        groupSize > 0
          ? Math.round(((topCorrect - bottomCorrect) / groupSize) * 100) / 100
          : 0;

      let discriminationLabel: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Jelek / Revisi' = 'Baik';
      if (discriminationIndex >= 0.4) discriminationLabel = 'Sangat Baik';
      else if (discriminationIndex >= 0.3) discriminationLabel = 'Baik';
      else if (discriminationIndex >= 0.2) discriminationLabel = 'Cukup';
      else discriminationLabel = 'Jelek / Revisi';

      // 3. Option Stats (Distractor Analysis)
      const optionsStats: OptionStat[] = rawOptions.map((opt) => {
        const count = optionFrequencyMap[opt.id] || 0;
        const percentage = totalParticipants > 0 ? Math.round((count / totalParticipants) * 100) : 0;
        return {
          id: opt.id,
          text: opt.text,
          isCorrect: Boolean(opt.isCorrect),
          count,
          percentage,
        };
      });

      // Recommendation logic
      let recommendation = 'Butir soal diterima dan berfungsi dengan baik.';
      if (discriminationIndex < 0.2) {
        if (difficultyIndex > 0.85) {
          recommendation = 'Soal terlalu mudah sehingga kurang membedakan siswa pandai dan lemah.';
        } else if (difficultyIndex < 0.15) {
          recommendation = 'Soal terlalu sukar atau terdapat ambiguitas pada kunci jawaban.';
        } else {
          recommendation = 'Daya pembeda rendah. Periksa pengecoh (distraktor) yang tidak berfungsi efektif.';
        }
      } else if (difficultyIndex < 0.25) {
        recommendation = 'Tingkat kesukaran tinggi. Cocok untuk soal pengayaan/HOTS.';
      }

      return {
        id: question.id,
        order: idx + 1,
        type: 'MULTIPLE_CHOICE',
        text: question.text,
        points: question.points,
        totalAttempts: totalParticipants,
        correctCount,
        incorrectCount,
        difficultyIndex,
        difficultyLabel,
        discriminationIndex,
        discriminationLabel,
        recommendation,
        optionsStats,
      };
    } else {
      // ESSAY Question Analysis
      const essayScores: number[] = [];
      let correctCount = 0; // count score >= 50% max points

      attempts.forEach((att) => {
        const studentAns = att.answers.find((ans) => ans.questionId === question.id);
        if (studentAns && studentAns.score !== null && studentAns.score !== undefined) {
          essayScores.push(studentAns.score);
          if (studentAns.score >= question.points * 0.6) {
            correctCount += 1;
          }
        }
      });

      const avgScore = essayScores.length > 0 ? essayScores.reduce((a, b) => a + b, 0) / essayScores.length : 0;
      const difficultyIndex = question.points > 0 ? Math.round((avgScore / question.points) * 100) / 100 : 0;

      let difficultyLabel: 'Mudah' | 'Sedang' | 'Sukar' = 'Sedang';
      if (difficultyIndex > 0.7) difficultyLabel = 'Mudah';
      else if (difficultyIndex < 0.3) difficultyLabel = 'Sukar';

      return {
        id: question.id,
        order: idx + 1,
        type: 'ESSAY',
        text: question.text,
        points: question.points,
        totalAttempts: essayScores.length,
        correctCount,
        incorrectCount: totalParticipants - correctCount,
        difficultyIndex,
        difficultyLabel,
        discriminationIndex: 0.3,
        discriminationLabel: 'Baik',
        recommendation: 'Soal uraian essay dievaluasi berdasarkan rubrik penilaian guru.',
        optionsStats: [],
        essayScoresSummary: {
          averageScore: Math.round(avgScore * 10) / 10,
          highestScore: essayScores.length > 0 ? Math.max(...essayScores) : 0,
          lowestScore: essayScores.length > 0 ? Math.min(...essayScores) : 0,
        },
      };
    }
  });

  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      courseId: quiz.module.courseId,
      courseTitle: quiz.module.course.title,
      passingGrade: quiz.passingGrade,
    },
    totalParticipants,
    averageScore,
    highestScore,
    lowestScore,
    passedCount,
    failedCount,
    passPercentage,
    questions: questionsAnalysis,
  };
}
