import { NextRequest, NextResponse } from 'next/server';
import { getServerSession as auth } from '@/lib/auth-utils';
import { parseAikenText } from '@/lib/utils/aiken-parser';
import { checkSharedRateLimit } from '@/lib/shared-rate-limit';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Sesi Anda telah berakhir, silakan login kembali' },
        { status: 401 }
      );
    }

    const role = session.user.role;
    if (!['TEACHER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: 'Akses ditolak: Peran tidak diizinkan' },
        { status: 403 }
      );
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const rateLimitKey = `quiz-import-aiken:${session.user.id || ipAddress}`;
    const rateLimit = await checkSharedRateLimit(rateLimitKey, 10, 60 * 1000);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Terlalu banyak permintaan pemrosesan format Aiken. Silakan tunggu ${rateLimit.resetInSeconds} detik.` },
        { status: 429, headers: { 'Retry-After': String(rateLimit.resetInSeconds) } }
      );
    }

    let textContent = '';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json();
      textContent = body.rawText || '';
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const rawTextParam = formData.get('rawText') as string | null;

      if (rawTextParam) {
        textContent = rawTextParam;
      } else if (file) {
        if (!file.name.toLowerCase().endsWith('.txt') && !file.name.toLowerCase().endsWith('.aiken')) {
          return NextResponse.json(
            { error: 'Format file tidak didukung. Harap unggah file teks (.txt atau .aiken)' },
            { status: 400 }
          );
        }
        textContent = await file.text();
      }
    }

    if (!textContent.trim()) {
      return NextResponse.json(
        { error: 'Tidak ada teks atau file yang dikirimkan untuk diproses.' },
        { status: 400 }
      );
    }

    const result = parseAikenText(textContent);

    return NextResponse.json({
      success: true,
      questions: result.questions,
      warnings: result.warnings,
      totalParsed: result.questions.length,
    });
  } catch (error: any) {
    console.error('Error parsing Aiken text:', error);
    return NextResponse.json(
      { error: error?.message || 'Terjadi kesalahan saat memproses format Aiken.' },
      { status: 500 }
    );
  }
}
