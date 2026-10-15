import { NextRequest, NextResponse } from 'next/server';
import { getServerSession as auth } from '@/lib/auth-utils';
import { parseMoodleBackup, buildMoodlePreview } from '@/lib/utils/moodle-parser';
import { saveStagingArchive } from '@/lib/utils/moodle-storage';
import { checkSharedRateLimit } from '@/lib/shared-rate-limit';
import crypto from 'node:crypto';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Sesi Anda telah berakhir, silakan masuk kembali.' },
        { status: 401 }
      );
    }

    const role = session.user.role;
    if (!['TEACHER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya pengajar dan administrator yang dapat mengimpor data.' },
        { status: 403 }
      );
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const rateLimitKey = `moodle-preview:${session.user.id || ipAddress}`;
    const rateLimit = await checkSharedRateLimit(rateLimitKey, 5, 60 * 1000);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Terlalu banyak permintaan impor. Silakan tunggu ${rateLimit.resetInSeconds} detik.` },
        { status: 429, headers: { 'Retry-After': String(rateLimit.resetInSeconds) } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Berkas backup Moodle (.mbz) tidak ditemukan.' },
        { status: 400 }
      );
    }

    const fileNameLower = file.name.toLowerCase();
    const isAllowedExt =
      fileNameLower.endsWith('.mbz') ||
      fileNameLower.endsWith('.tar.gz') ||
      fileNameLower.endsWith('.zip');

    if (!isAllowedExt) {
      return NextResponse.json(
        { error: 'Format berkas tidak didukung. Harap unggah berkas .mbz, .tar.gz, atau .zip.' },
        { status: 400 }
      );
    }

    // Limit upload to 200MB
    const MAX_SIZE_BYTES = 200 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Ukuran berkas melebihi batas maksimum 200 MB.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const sessionId = crypto.randomUUID();
    await saveStagingArchive(sessionId, buffer);

    const parsedData = await parseMoodleBackup(buffer);
    const preview = buildMoodlePreview(parsedData);

    return NextResponse.json({
      success: true,
      sessionId,
      preview,
    });
  } catch (error: any) {
    console.error('Error saat memproses preview Moodle:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal menganalisis berkas backup Moodle.' },
      { status: 500 }
    );
  }
}
