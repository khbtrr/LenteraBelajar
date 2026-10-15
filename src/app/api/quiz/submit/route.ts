import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth-utils';
import { submitQuiz } from '@/lib/cbt';
import { checkSharedRateLimit } from '@/lib/shared-rate-limit';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) return NextResponse.json({ error: 'Sesi Anda telah berakhir' }, { status: 401 });

  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const rateLimitKey = `quiz-submit:${session.user.id || ipAddress}`;
  const rateLimit = await checkSharedRateLimit(rateLimitKey, 10, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: `Terlalu banyak permintaan pengumpulan kuis. Harap tunggu ${rateLimit.resetInSeconds} detik.` },
      { status: 429, headers: { 'Retry-After': String(rateLimit.resetInSeconds) } }
    );
  }

  try {
    const { attemptId, answers } = await req.json();
    if (typeof attemptId !== 'string') return NextResponse.json({ error: 'attemptId wajib diisi' }, { status: 400 });
    return NextResponse.json(await submitQuiz(attemptId, answers));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal mengumpulkan kuis' }, { status: 400 });
  }
}
