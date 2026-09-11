import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { QuestionType, GradeType } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Sesi Anda telah berakhir, silakan login kembali' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { attemptId, answers } = body as {
      attemptId: string;
      answers: { questionId: string; answer: string }[];
    };

    if (!attemptId) {
      return NextResponse.json(
        { error: 'ID pengerjaan kuis (attemptId) tidak ditemukan' },
        { status: 400 }
      );
    }

    const attempt = await db.quizAttempt.findUnique({
      where: { id: attemptId, userId: session.user.id },
      include: {
        quiz: {
          include: {
            questions: true,
            module: true,
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: 'Data pengerjaan kuis tidak ditemukan' },
        { status: 404 }
      );
    }

    // If already submitted (e.g. from network retry or prior auto-submit), return idempotent success
    if (attempt.submittedAt) {
      return NextResponse.json({
        success: true,
        score: attempt.score,
        isGraded: attempt.isGraded,
        alreadySubmitted: true,
      });
    }

    let totalScore = 0;
    let totalPoints = 0;
    let hasEssay = false;

    let activeQuestions: any[] = [];

    if (attempt.quiz.useQuestionBank && attempt.questionSnapshot) {
      activeQuestions = attempt.questionSnapshot as any[];
    } else {
      activeQuestions = attempt.quiz.questions;
    }

    // Delete any partial answers if re-submitting before recording
    await db.quizAnswer.deleteMany({
      where: { attemptId: attempt.id },
    });

    for (const q of activeQuestions) {
      totalPoints += q.points;
      const studentAns = (answers || []).find((a) => a.questionId === q.id);
      const answerText = studentAns?.answer || '';

      let questionScore: number | null = null;

      if (q.type === QuestionType.MULTIPLE_CHOICE) {
        let options = [];
        if (attempt.quiz.useQuestionBank && attempt.questionSnapshot) {
          options = q._correctData || [];
        } else {
          options = (q.options as any[]) || [];
        }

        const correctOption = options.find((opt: any) => opt.isCorrect);
        if (correctOption && studentAns && studentAns.answer === correctOption.id) {
          questionScore = q.points;
          totalScore += q.points;
        } else {
          questionScore = 0;
        }
      } else {
        hasEssay = true;
        questionScore = null;
      }

      await db.quizAnswer.create({
        data: {
          attemptId: attempt.id,
          questionId: q.id,
          answer: answerText,
          score: questionScore,
        },
      });
    }

    const finalPercentage = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
    const isFullyGraded = !hasEssay;
    const currentAttemptScore = isFullyGraded ? Math.round(finalPercentage * 10) / 10 : null;

    await db.quizAttempt.update({
      where: { id: attemptId },
      data: {
        submittedAt: new Date(),
        score: currentAttemptScore,
        isGraded: isFullyGraded,
      },
    });

    if (isFullyGraded) {
      const allAttempts = await db.quizAttempt.findMany({
        where: {
          quizId: attempt.quizId,
          userId: session.user.id,
          submittedAt: { not: null },
          score: { not: null },
        },
      });

      const bestScore = Math.max(
        ...allAttempts.map((a) => a.score as number),
        currentAttemptScore as number
      );

      const existingGrade = await db.grade.findFirst({
        where: {
          userId: session.user.id,
          courseId: attempt.quiz.module.courseId,
          type: GradeType.QUIZ,
          label: attempt.quiz.title,
        },
      });

      if (existingGrade) {
        await db.grade.update({
          where: { id: existingGrade.id },
          data: { score: bestScore, sourceId: attempt.id },
        });
      } else {
        await db.grade.create({
          data: {
            courseId: attempt.quiz.module.courseId,
            userId: session.user.id,
            label: attempt.quiz.title,
            score: bestScore,
            maxScore: 100,
            type: GradeType.QUIZ,
            sourceId: attempt.id,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      score: currentAttemptScore,
      isGraded: isFullyGraded,
    });
  } catch (error: any) {
    console.error('Error submitting quiz attempt via API:', error);
    return NextResponse.json(
      { error: error?.message || 'Terjadi kesalahan saat mengumpulkan kuis' },
      { status: 500 }
    );
  }
}
