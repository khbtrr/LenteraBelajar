import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth-utils';
import { saveQuizDraft } from '@/lib/cbt';

export async function POST(req: NextRequest) {
  if (!await getServerSession()) return NextResponse.json({ error: 'Sesi Anda telah berakhir' }, { status: 401 });
  try {
    const { attemptId, answers } = await req.json();
    if (typeof attemptId !== 'string') return NextResponse.json({ error: 'attemptId wajib diisi' }, { status: 400 });
    return NextResponse.json(await saveQuizDraft(attemptId, answers));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal menyimpan draft' }, { status: 400 });
  }
}
