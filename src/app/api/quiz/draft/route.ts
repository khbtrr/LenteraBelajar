import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

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
        { error: 'attemptId wajib diisi' },
        { status: 400 }
      );
    }

    const attempt = await db.quizAttempt.findUnique({
      where: { id: attemptId, userId: session.user.id },
      select: { id: true, submittedAt: true },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: 'Data pengerjaan tidak ditemukan' },
        { status: 404 }
      );
    }

    if (attempt.submittedAt) {
      return NextResponse.json(
        { error: 'Kuis sudah dikumpulkan' },
        { status: 400 }
      );
    }

    // Save/update draft answers in transaction or batch
    if (Array.isArray(answers) && answers.length > 0) {
      for (const a of answers) {
        if (!a.questionId) continue;
        const existingAnswer = await db.quizAnswer.findFirst({
          where: {
            attemptId: attempt.id,
            questionId: a.questionId,
          },
          select: { id: true },
        });

        if (existingAnswer) {
          await db.quizAnswer.update({
            where: { id: existingAnswer.id },
            data: { answer: a.answer || '' },
          });
        } else {
          await db.quizAnswer.create({
            data: {
              attemptId: attempt.id,
              questionId: a.questionId,
              answer: a.answer || '',
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      savedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Draft auto-save error:', error);
    return NextResponse.json(
      { error: error?.message || 'Gagal menyimpan draft kuis' },
      { status: 500 }
    );
  }
}
