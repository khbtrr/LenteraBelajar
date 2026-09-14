'use server';

import { db } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';
import { createNotification, createBulkNotifications } from './notification';

export async function getAssignmentById(assignmentId: string) {
  const session = await requireAuth();

  return db.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      module: {
        include: {
          course: true,
        },
      },
      submissions: {
        where:
          session.user.role === 'STUDENT'
            ? { userId: session.user.id }
            : undefined,
        include: {
          user: {
            select: { id: true, name: true, email: true, nis: true },
          },
        },
      },
      _count: {
        select: { submissions: true },
      },
    },
  });
}

export async function createAssignment(data: {
  moduleId: string;
  title: string;
  description?: string;
  deadline?: string;
  maxScore?: number;
  maxFileSize?: number;
  allowedTypes?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const count = await db.assignment.count({ where: { moduleId: data.moduleId } });

  const assignment = await db.assignment.create({
    data: {
      moduleId: data.moduleId,
      title: data.title,
      description: data.description || null,
      deadline: data.deadline ? new Date(data.deadline) : null,
      maxScore: Number(data.maxScore || 100),
      maxFileSize: data.maxFileSize ? Number(data.maxFileSize) : 25,
      allowedTypes: data.allowedTypes || 'pdf,docx,zip,pptx,xlsx',
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      fileSize: data.fileSize || null,
      isPublished: true,
      order: count,
    },
  });

  // Notify enrolled students
  try {
    const moduleData = await db.module.findUnique({
      where: { id: data.moduleId },
      include: {
        course: {
          include: {
            enrollments: { select: { userId: true } },
          },
        },
      },
    });

    if (moduleData && moduleData.course.enrollments.length > 0) {
      const studentIds = moduleData.course.enrollments.map((e) => e.userId);
      await createBulkNotifications(studentIds, {
        title: `Tugas Baru: ${assignment.title}`,
        message: `Guru telah menambahkan tugas baru di ${moduleData.course.title}${assignment.deadline ? `. Batas pengumpulan: ${new Date(assignment.deadline).toLocaleDateString('id-ID')}` : ''}.`,
        type: 'ASSIGNMENT',
        link: `/student/course/${moduleData.course.id}/assignment/${assignment.id}`,
      });
    }
  } catch (err) {
    console.error('Failed to notify students on createAssignment:', err);
  }

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  return assignment;
}

export async function updateAssignment(data: {
  id: string;
  title: string;
  description?: string;
  deadline?: string | null;
  maxScore?: number;
  maxFileSize?: number;
  allowedTypes?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
}) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const assignment = await db.assignment.update({
    where: { id: data.id },
    data: {
      title: data.title,
      description: data.description || null,
      deadline: data.deadline ? new Date(data.deadline) : null,
      maxScore: Number(data.maxScore || 100),
      maxFileSize: data.maxFileSize ? Number(data.maxFileSize) : 25,
      allowedTypes: data.allowedTypes || 'pdf,docx,zip,pptx,xlsx',
      fileUrl: data.fileUrl !== undefined ? data.fileUrl : undefined,
      fileName: data.fileName !== undefined ? data.fileName : undefined,
      fileSize: data.fileSize !== undefined ? data.fileSize : undefined,
    },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  revalidatePath('/[locale]/teacher/course/[courseId]/submissions/[assignmentId]', 'page');
  revalidatePath('/[locale]/student/course/[courseId]/assignment/[assignmentId]', 'page');
  return assignment;
}

export async function deleteAssignment(assignmentId: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const deleted = await db.assignment.delete({
    where: { id: assignmentId },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/modules', 'page');
  return deleted;
}

export async function submitAssignment(data: {
  assignmentId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
}) {
  const session = await requireAuth();

  const existing = await db.assignmentSubmission.findFirst({
    where: {
      assignmentId: data.assignmentId,
      userId: session.user.id,
    },
  });

  let submission;
  if (existing) {
    submission = await db.assignmentSubmission.update({
      where: { id: existing.id },
      data: {
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        submittedAt: new Date(),
      },
    });
  } else {
    submission = await db.assignmentSubmission.create({
      data: {
        assignmentId: data.assignmentId,
        userId: session.user.id,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        submittedAt: new Date(),
      },
    });
  }

  // Notify course teacher
  try {
    const assignment = await db.assignment.findUnique({
      where: { id: data.assignmentId },
      include: {
        module: {
          include: {
            course: {
              select: { id: true, title: true, teacherId: true },
            },
          },
        },
      },
    });

    if (assignment?.module.course.teacherId) {
      await createNotification({
        userId: assignment.module.course.teacherId,
        title: `Pengumpulan Tugas: ${session.user.name}`,
        message: `Siswa telah mengumpulkan tugas "${assignment.title}" pada mata pelajaran ${assignment.module.course.title}.`,
        type: 'SUBMISSION',
        link: `/teacher/course/${assignment.module.course.id}/submissions/${assignment.id}`,
      });
    }
  } catch (err) {
    console.error('Failed to notify teacher on submitAssignment:', err);
  }

  revalidatePath('/[locale]/student/course/[courseId]/assignment/[assignmentId]', 'page');
  return submission;
}
