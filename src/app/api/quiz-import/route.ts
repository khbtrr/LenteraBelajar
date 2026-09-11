import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { parseDocxQuestions, ImageHandler } from '@/lib/utils/quiz-import';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export async function POST(req: NextRequest) {
  try {
    // Authorize user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Sesi Anda telah berakhir, silakan login kembali' }, { status: 401 });
    }

    const role = session.user.role;
    if (!['TEACHER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak: Peran tidak diizinkan' }, { status: 403 });
    }

    // Parse formData
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const courseId = formData.get('courseId') as string | null;
    const categoryId = formData.get('categoryId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'File dokumen tidak ditemukan' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.docx')) {
      return NextResponse.json({ error: 'Format file tidak didukung. Harap unggah file .docx' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Image handler: compress images to WebP (max width 1200px, 80% quality) and save to uploads/
    const imageHandler: ImageHandler = async (imgBuffer: Buffer, contentType: string) => {
      try {
        const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');
        await mkdir(uploadDir, { recursive: true });

        let processedBuffer: Buffer = imgBuffer;
        let ext = 'webp';

        try {
          processedBuffer = await sharp(imgBuffer)
            .resize({ width: 1200, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
        } catch (sharpErr) {
          console.warn('Sharp compression failed, using original format:', sharpErr);
          ext = contentType.includes('jpeg') || contentType.includes('jpg')
            ? 'jpg'
            : contentType.includes('png')
            ? 'png'
            : contentType.includes('gif')
            ? 'gif'
            : 'webp';
          processedBuffer = imgBuffer;
        }

        const randomStr = Math.random().toString(36).substring(2, 8);
        const fileName = `quiz_img_${Date.now()}_${randomStr}.${ext}`;
        const filePath = path.join(uploadDir, fileName);

        await writeFile(filePath, processedBuffer);
        return `/api/files/${fileName}`;
      } catch (err) {
        console.error('Error saving imported image:', err);
        // Fallback to data URI if disk write fails
        return `data:${contentType};base64,${imgBuffer.toString('base64')}`;
      }
    };
    
    // Parse the file with image upload handler
    const { questions, warnings } = await parseDocxQuestions(buffer, imageHandler);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Handle DB Import if action=import is present
    if (action === 'import') {
      if (!courseId) {
        return NextResponse.json({ error: 'courseId wajib diisi untuk menyimpan soal' }, { status: 400 });
      }

      if (questions.length === 0) {
        return NextResponse.json({ error: 'Tidak ada soal valid yang ditemukan untuk diimpor' }, { status: 400 });
      }

      await db.$transaction(
        questions.map((q) =>
          db.questionBank.create({
            data: {
              courseId,
              categoryId: categoryId || null,
              type: q.type,
              text: q.text,
              points: q.points,
              options: q.type === 'MULTIPLE_CHOICE' ? (q.options as any) : undefined,
            },
          })
        )
      );

      return NextResponse.json({
        message: 'Berhasil mengimpor soal',
        importedCount: questions.length,
        warnings,
      });
    }

    // Default to Preview Mode
    return NextResponse.json({
      questions,
      warnings,
    });
  } catch (error: any) {
    console.error('Quiz Import Error:', error);
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat memproses file docx' },
      { status: 500 }
    );
  }
}
