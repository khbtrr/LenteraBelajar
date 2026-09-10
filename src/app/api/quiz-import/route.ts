import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { parseDocxQuestions } from '@/lib/utils/quiz-import';

export async function POST(req: NextRequest) {
  try {
    // Authorize user
    await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

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

    if (!courseId) {
      return NextResponse.json({ error: 'courseId wajib diisi' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Parse the file
    const { questions, warnings } = await parseDocxQuestions(buffer);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Handle DB Import if action=import is present
    if (action === 'import') {
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
