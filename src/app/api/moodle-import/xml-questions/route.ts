import { NextRequest, NextResponse } from 'next/server';
import { getServerSession as auth } from '@/lib/auth-utils';
import { bindRecentCourseAssets } from '@/lib/files';
import { db } from '@/lib/db';
import { parseMoodleXmlQuestions } from '@/lib/utils/moodle-parser';
import { saveImageFile } from '@/lib/utils/moodle-storage';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  try {
    const startedAt = new Date();
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
        { error: 'Akses ditolak: Hanya pengajar dan administrator yang diizinkan.' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const courseId = formData.get('courseId') as string | null;
    const targetCategoryId = formData.get('categoryId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Berkas Moodle XML tidak ditemukan.' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.xml')) {
      return NextResponse.json(
        { error: 'Format berkas tidak didukung. Harap unggah berkas .xml berformat Moodle XML.' },
        { status: 400 }
      );
    }

    const xmlText = await file.text();

    const imageHandler = async (
      imgBuffer: Buffer,
      _contentType: string,
      origName: string
    ) => {
      return saveImageFile(imgBuffer, origName);
    };

    const { questions, warnings } = await parseMoodleXmlQuestions(xmlText, imageHandler);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'import') {
      if (!courseId) {
        return NextResponse.json(
          { error: 'courseId wajib disertakan untuk menyimpan soal ke Bank Soal.' },
          { status: 400 }
        );
      }

      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { id: true, teacherId: true, schoolId: true },
      });

      if (!course) {
        return NextResponse.json(
          { error: 'Kursus tidak ditemukan.' },
          { status: 404 }
        );
      }

      if (role === 'TEACHER' && course.teacherId !== session.user.id) {
        return NextResponse.json(
          { error: 'Akses ditolak: Anda bukan pengajar untuk kelas ini.' },
          { status: 403 }
        );
      }

      if (role === 'ADMIN' && session.user.schoolId && course.schoolId !== session.user.schoolId) {
        return NextResponse.json(
          { error: 'Akses ditolak: Kursus berada di luar sekolah Anda.' },
          { status: 403 }
        );
      }

      if (questions.length === 0) {
        return NextResponse.json(
          { error: 'Tidak ada soal valid yang ditemukan di dalam file XML.' },
          { status: 400 }
        );
      }

      // Group questions by category unless a targetCategoryId is explicitly chosen
      const categoryMap = new Map<string, typeof questions>();
      for (const q of questions) {
        const catKey = targetCategoryId ? 'SELECTED' : q.categoryName || 'Umum';
        if (!categoryMap.has(catKey)) {
          categoryMap.set(catKey, []);
        }
        categoryMap.get(catKey)!.push(q);
      }

      let totalInserted = 0;

      for (const [catName, qList] of categoryMap.entries()) {
        let finalCatId = targetCategoryId;

        if (!finalCatId) {
          let catRecord = await db.questionBankCategory.findFirst({
            where: { courseId, name: catName },
          });

          if (!catRecord) {
            catRecord = await db.questionBankCategory.create({
              data: { courseId, name: catName },
            });
          }
          finalCatId = catRecord.id;
        }

        await db.questionBank.createMany({
          data: qList.map((q) => ({
            courseId,
            categoryId: finalCatId,
            type: q.type,
            text: q.text,
            options: q.type !== 'ESSAY' ? (q.options as any) : undefined,
            points: q.points || 1,
          })),
        });

        totalInserted += qList.length;
      }

      await bindRecentCourseAssets(courseId, startedAt);
      revalidatePath('/[locale]/teacher/course/[courseId]', 'layout');

      return NextResponse.json({
        success: true,
        message: `Berhasil mengimpor ${totalInserted} soal ke Bank Soal.`,
        importedCount: totalInserted,
        warnings,
      });
    }

    // Default to preview mode
    return NextResponse.json({
      success: true,
      questions,
      warnings,
    });
  } catch (error: any) {
    console.error('Error saat memproses Moodle XML:', error);
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat memproses berkas Moodle XML.' },
      { status: 500 }
    );
  }
}
