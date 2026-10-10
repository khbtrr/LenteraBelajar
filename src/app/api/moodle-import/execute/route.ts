import { NextRequest, NextResponse } from 'next/server';
import { getServerSession as auth } from '@/lib/auth-utils';
import { bindRecentCourseAssets } from '@/lib/files';
import { assertAcademicReferences } from '@/lib/access';
import { db } from '@/lib/db';
import { parseMoodleBackup } from '@/lib/utils/moodle-parser';
import {
  readStagingArchive,
  deleteStagingArchive,
  saveDocumentFile,
  saveImageFile,
} from '@/lib/utils/moodle-storage';
import { revalidatePath } from 'next/cache';

interface ExecuteRequestPayload {
  sessionId: string;
  targetMode: 'EXISTING' | 'NEW';
  courseId?: string;
  newCourse?: {
    schoolId?: string;
    academicYearId?: string;
    teacherId?: string;
    title?: string;
    description?: string;
    categoryId?: string | null;
  };
  selectedSections?: string[];
  selectedItems?: string[];
  importToQuestionBank?: boolean;
}

function isVideoUrl(url: string): boolean {
  if (!url) return false;
  return /youtube\.com|youtu\.be|vimeo\.com|\.mp4|\.webm/i.test(url);
}

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
        { error: 'Akses ditolak: Hanya pengajar dan administrator yang dapat melakukan migrasi.' },
        { status: 403 }
      );
    }

    const body: ExecuteRequestPayload = await req.json();
    const {
      sessionId,
      targetMode,
      courseId,
      newCourse,
      selectedSections = [],
      selectedItems = [],
      importToQuestionBank = true,
    } = body;

    if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return NextResponse.json(
        { error: 'Identifikasi sesi unggahan tidak valid.' },
        { status: 400 }
      );
    }

    let archiveBuffer: Buffer;
    try {
      archiveBuffer = await readStagingArchive(sessionId);
    } catch {
      return NextResponse.json(
        { error: 'Sesi unggahan kedaluwarsa atau berkas tidak ditemukan. Harap unggah kembali.' },
        { status: 400 }
      );
    }

    // Image handler for rewrites and compression
    const imageHandler = async (
      imgBuf: Buffer,
      _contentType: string,
      origName: string
    ) => {
      return saveImageFile(imgBuf, origName);
    };

    const parsedData = await parseMoodleBackup(archiveBuffer, imageHandler);

    // 1. Resolve Target Course
    let targetCourseId = courseId;
    let targetSchoolId = session.user.schoolId;

    if (targetMode === 'NEW') {
      const title = newCourse?.title?.trim() || parsedData.courseInfo.fullname || 'Kursus Baru Moodle';
      const description = newCourse?.description?.trim() || parsedData.courseInfo.summary || null;

      let schoolId = session.user.role === 'SUPER_ADMIN'
        ? (newCourse?.schoolId || session.user.schoolId)
        : session.user.schoolId;

      if (!schoolId) {
        if (session.user.role === 'SUPER_ADMIN') {
          const defaultSchool = await db.school.findFirst({ select: { id: true } });
          if (!defaultSchool) {
            throw new Error('Tidak ada data sekolah terdaftar di sistem.');
          }
          schoolId = defaultSchool.id;
        } else {
          return NextResponse.json(
            { error: 'Sekolah pengguna tidak terdefinisi.' },
            { status: 400 }
          );
        }
      }

      let teacherId = newCourse?.teacherId || session.user.id;
      if (role === 'TEACHER') {
        teacherId = session.user.id;
      }

      let academicYearId = newCourse?.academicYearId;
      if (!academicYearId) {
        const activeYear = await db.academicYear.findFirst({
          where: { schoolId, status: 'ACTIVE' },
          select: { id: true },
        });
        if (!activeYear) {
          throw new Error('Tidak ditemukan Tahun Ajaran aktif untuk sekolah ini.');
        }
        academicYearId = activeYear.id;
      }

      await assertAcademicReferences(schoolId, { academicYearId, categoryId: newCourse?.categoryId, teacherId });
      const created = await db.course.create({
        data: {
          title,
          description,
          schoolId,
          teacherId,
          academicYearId,
          categoryId: newCourse?.categoryId || null,
          status: 'DRAFT',
        },
      });

      targetCourseId = created.id;
      targetSchoolId = created.schoolId;
    } else {
      if (!targetCourseId) {
        return NextResponse.json(
          { error: 'courseId wajib disertakan untuk target kursus yang sudah ada.' },
          { status: 400 }
        );
      }

      const existingCourse = await db.course.findUnique({
        where: { id: targetCourseId },
        select: { id: true, teacherId: true, schoolId: true },
      });

      if (!existingCourse) {
        return NextResponse.json(
          { error: 'Kursus tujuan tidak ditemukan.' },
          { status: 404 }
        );
      }

      if (role === 'TEACHER' && existingCourse.teacherId !== session.user.id) {
        return NextResponse.json(
          { error: 'Akses ditolak: Anda bukan pengajar untuk kursus ini.' },
          { status: 403 }
        );
      }

      if (role === 'ADMIN' && session.user.schoolId && existingCourse.schoolId !== session.user.schoolId) {
        return NextResponse.json(
          { error: 'Akses ditolak: Kursus berada di luar sekolah Anda.' },
          { status: 403 }
        );
      }

      targetSchoolId = existingCourse.schoolId;
    }

    // 2. Determine initial order for modules
    const maxOrderAggregate = await db.module.aggregate({
      where: { courseId: targetCourseId },
      _max: { order: true },
    });
    let currentModuleOrder = (maxOrderAggregate._max.order ?? -1) + 1;

    const selectedItemSet = new Set(selectedItems);
    const selectedSectionSet = new Set(selectedSections);
    const hasItemSelection = selectedItemSet.size > 0;

    let importedModulesCount = 0;
    let importedContentsCount = 0;
    let importedAssignmentsCount = 0;
    let importedQuizzesCount = 0;
    let importedQuestionsCount = 0;

    // 3. Process Sections and Activities
    for (const sec of parsedData.sections) {
      const secPages = parsedData.pages.filter((p) => p.sectionId === sec.id);
      const secResources = parsedData.resources.filter((r) => r.sectionId === sec.id);
      const secUrls = parsedData.urls.filter((u) => u.sectionId === sec.id);
      const secAssigns = parsedData.assignments.filter((a) => a.sectionId === sec.id);
      const secQuizzes = parsedData.quizzes.filter((q) => q.sectionId === sec.id);

      const filteredPages = hasItemSelection
        ? secPages.filter((p) => selectedItemSet.has(`page_${p.id}`))
        : secPages;
      const filteredResources = hasItemSelection
        ? secResources.filter((r) => selectedItemSet.has(`resource_${r.id}`))
        : secResources;
      const filteredUrls = hasItemSelection
        ? secUrls.filter((u) => selectedItemSet.has(`url_${u.id}`))
        : secUrls;
      const filteredAssigns = hasItemSelection
        ? secAssigns.filter((a) => selectedItemSet.has(`assign_${a.id}`))
        : secAssigns;
      const filteredQuizzes = hasItemSelection
        ? secQuizzes.filter((q) => selectedItemSet.has(`quiz_${q.id}`))
        : secQuizzes;

      const totalItemsInSection =
        filteredPages.length +
        filteredResources.length +
        filteredUrls.length +
        filteredAssigns.length +
        filteredQuizzes.length;

      // Skip section if no items selected and section itself not selected
      if (totalItemsInSection === 0 && !selectedSectionSet.has(sec.id)) {
        continue;
      }

      // Create Module
      const createdModule = await db.module.create({
        data: {
          courseId: targetCourseId,
          title: sec.title,
          order: currentModuleOrder++,
        },
      });
      importedModulesCount++;

      let itemOrder = 0;

      // Pages (Materi Teks)
      for (const page of filteredPages) {
        await db.content.create({
          data: {
            moduleId: createdModule.id,
            title: page.title,
            type: 'TEXT',
            body: page.content || page.intro || '',
            order: itemOrder++,
          },
        });
        importedContentsCount++;
      }

      // Resources (Berkas Materi)
      for (const res of filteredResources) {
        let fileUrl = '';
        let fileName = res.fileName;
        let fileSize = res.fileSize;

        const fileEntry = parsedData.filesMap.get(res.contentHash);
        if (fileEntry?.buffer) {
          const saved = await saveDocumentFile(fileEntry.buffer, res.fileName);
          fileUrl = saved.fileUrl;
          fileName = saved.fileName;
          fileSize = saved.fileSize;
        }

        await db.content.create({
          data: {
            moduleId: createdModule.id,
            title: res.title,
            type: 'FILE',
            fileUrl: fileUrl || null,
            fileName: fileName || null,
            fileSize: fileSize || null,
            order: itemOrder++,
          },
        });
        importedContentsCount++;
      }

      // URLs (Tautan / Video)
      for (const u of filteredUrls) {
        const isVid = isVideoUrl(u.externalUrl);
        await db.content.create({
          data: {
            moduleId: createdModule.id,
            title: u.title,
            type: isVid ? 'VIDEO' : 'TEXT',
            body: isVid
              ? u.externalUrl
              : `<p><a href="${u.externalUrl}" target="_blank" rel="noopener noreferrer">${u.title}</a></p>`,
            order: itemOrder++,
          },
        });
        importedContentsCount++;
      }

      // Assignments (Penugasan)
      for (const assign of filteredAssigns) {
        let fileUrl: string | null = null;
        let fileName: string | null = null;
        let fileSize: number | null = null;

        if (assign.attachmentFile) {
          const fileEntry = parsedData.filesMap.get(assign.attachmentFile.contentHash);
          if (fileEntry?.buffer) {
            const saved = await saveDocumentFile(
              fileEntry.buffer,
              assign.attachmentFile.fileName
            );
            fileUrl = saved.fileUrl;
            fileName = saved.fileName;
            fileSize = saved.fileSize;
          }
        }

        await db.assignment.create({
          data: {
            moduleId: createdModule.id,
            title: assign.title,
            description: assign.intro || null,
            deadline: assign.deadline || null,
            maxScore: assign.maxScore || 100,
            isPublished: false, // Initial status: Draf / Hidden per grill-me decision
            fileUrl,
            fileName,
            fileSize,
            order: itemOrder++,
          },
        });
        importedAssignmentsCount++;
      }

      // Quizzes (Kuis)
      for (const quiz of filteredQuizzes) {
        const createdQuiz = await db.quiz.create({
          data: {
            moduleId: createdModule.id,
            title: quiz.title,
            description: quiz.intro || null,
            duration: quiz.durationMinutes || null,
            deadline: quiz.deadline || null,
            passingGrade: quiz.passingGrade || null,
            shuffleQuestions: quiz.shuffleQuestions,
            shuffleOptions: quiz.shuffleOptions,
            isPublished: false, // Initial status: Draf / Hidden per grill-me decision
            order: itemOrder++,
          },
        });
        importedQuizzesCount++;

        // Add questions to quiz
        for (let qIdx = 0; qIdx < quiz.questions.length; qIdx++) {
          const q = quiz.questions[qIdx];
          await db.quizQuestion.create({
            data: {
              quizId: createdQuiz.id,
              type: q.type,
              text: q.text,
              options: q.type !== 'ESSAY' ? (q.options as any) : undefined,
              points: q.points || 1,
              order: qIdx,
            },
          });
          importedQuestionsCount++;
        }
      }
    }

    // 4. Import to Question Bank if requested
    let importedBankQuestionsCount = 0;
    if (importToQuestionBank && parsedData.questionBank.length > 0) {
      // Group by category name
      const categoriesMap = new Map<string, typeof parsedData.questionBank>();
      for (const q of parsedData.questionBank) {
        const cat = q.categoryName || 'Umum';
        if (!categoriesMap.has(cat)) {
          categoriesMap.set(cat, []);
        }
        categoriesMap.get(cat)!.push(q);
      }

      for (const [catName, questions] of categoriesMap.entries()) {
        let categoryRecord = await db.questionBankCategory.findFirst({
          where: { courseId: targetCourseId, name: catName },
        });

        if (!categoryRecord) {
          categoryRecord = await db.questionBankCategory.create({
            data: {
              courseId: targetCourseId,
              name: catName,
            },
          });
        }

        await db.questionBank.createMany({
          data: questions.map((q) => ({
            courseId: targetCourseId,
            categoryId: categoryRecord!.id,
            type: q.type,
            text: q.text,
            options: q.type !== 'ESSAY' ? (q.options as any) : undefined,
            points: q.points || 1,
          })),
        });
        importedBankQuestionsCount += questions.length;
      }
    }

    // 5. Clean up staging archive file
    await deleteStagingArchive(sessionId);

    await bindRecentCourseAssets(targetCourseId!, startedAt);
    // 6. Revalidate Next.js cache
    revalidatePath('/[locale]/teacher/course/[courseId]', 'layout');
    revalidatePath('/[locale]/admin/courses', 'page');

    return NextResponse.json({
      success: true,
      courseId: targetCourseId,
      stats: {
        importedModules: importedModulesCount,
        importedContents: importedContentsCount,
        importedAssignments: importedAssignmentsCount,
        importedQuizzes: importedQuizzesCount,
        importedQuestions: importedQuestionsCount,
        importedBankQuestions: importedBankQuestionsCount,
      },
    });
  } catch (error: any) {
    console.error('Error saat eksekusi import Moodle:', error);
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat memproses data migrasi Moodle.' },
      { status: 500 }
    );
  }
}
