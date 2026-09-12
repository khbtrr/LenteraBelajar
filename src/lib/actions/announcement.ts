'use server';

import { db } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';

export async function createCourseAnnouncement(data: {
  courseId: string;
  title: string;
  content: string;
  isPinned?: boolean;
}) {
  const session = await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const course = await db.course.findUnique({
    where: { id: data.courseId },
    include: {
      enrollments: {
        select: { userId: true },
      },
    },
  });

  if (!course) throw new Error('Kursus tidak ditemukan');

  const announcement = await db.courseAnnouncement.create({
    data: {
      courseId: data.courseId,
      authorId: session.user.id,
      title: data.title,
      content: data.content,
      isPinned: data.isPinned ?? false,
    },
    include: {
      author: {
        select: { id: true, name: true, role: true, avatar: true },
      },
    },
  });

  // Batch notifications to all enrolled students
  if (course.enrollments.length > 0) {
    await db.notification.createMany({
      data: course.enrollments.map((enr) => ({
        userId: enr.userId,
        title: `Pengumuman Baru: ${course.title}`,
        message: data.title,
        type: 'COURSE_ANNOUNCEMENT',
        link: `/student/course/${data.courseId}/forum`,
      })),
    });
  }

  revalidatePath(`/teacher/course/${data.courseId}/forum`);
  revalidatePath(`/student/course/${data.courseId}/forum`);
  revalidatePath(`/student/course/${data.courseId}/modules`);

  return announcement;
}

export async function getCourseAnnouncements(courseId: string) {
  await requireAuth();

  return db.courseAnnouncement.findMany({
    where: { courseId },
    orderBy: [
      { isPinned: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      author: {
        select: { id: true, name: true, role: true, avatar: true },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: {
            select: { id: true, name: true, role: true, avatar: true },
          },
        },
      },
    },
  });
}

export async function getPinnedAnnouncement(courseId: string) {
  await requireAuth();

  return db.courseAnnouncement.findFirst({
    where: { courseId, isPinned: true },
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: { id: true, name: true, role: true },
      },
    },
  });
}

export async function togglePinAnnouncement(announcementId: string, isPinned: boolean) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const updated = await db.courseAnnouncement.update({
    where: { id: announcementId },
    data: { isPinned },
  });

  revalidatePath(`/teacher/course/${updated.courseId}/forum`);
  revalidatePath(`/student/course/${updated.courseId}/forum`);
  revalidatePath(`/student/course/${updated.courseId}/modules`);
  return updated;
}

export async function deleteCourseAnnouncement(announcementId: string) {
  const session = await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const announcement = await db.courseAnnouncement.findUnique({
    where: { id: announcementId },
  });

  if (!announcement) throw new Error('Pengumuman tidak ditemukan');

  await db.courseAnnouncement.delete({
    where: { id: announcementId },
  });

  revalidatePath(`/teacher/course/${announcement.courseId}/forum`);
  revalidatePath(`/student/course/${announcement.courseId}/forum`);
  revalidatePath(`/student/course/${announcement.courseId}/modules`);
  return announcement;
}

export async function addAnnouncementComment(announcementId: string, content: string) {
  const session = await requireAuth();

  if (!content || !content.trim()) {
    throw new Error('Komentar tidak boleh kosong');
  }

  const comment = await db.announcementComment.create({
    data: {
      announcementId,
      authorId: session.user.id,
      content: content.trim(),
    },
    include: {
      author: {
        select: { id: true, name: true, role: true, avatar: true },
      },
      announcement: {
        select: { courseId: true, authorId: true, title: true },
      },
    },
  });

  // If student commented, optionally notify teacher
  if (session.user.id !== comment.announcement.authorId) {
    await db.notification.create({
      data: {
        userId: comment.announcement.authorId,
        title: `Tanggapan Pengumuman: ${comment.announcement.title}`,
        message: `${session.user.name} memberikan komentar pada pengumuman Anda.`,
        type: 'ANNOUNCEMENT_COMMENT',
        link: `/teacher/course/${comment.announcement.courseId}/forum`,
      },
    });
  }

  revalidatePath(`/teacher/course/${comment.announcement.courseId}/forum`);
  revalidatePath(`/student/course/${comment.announcement.courseId}/forum`);

  return comment;
}

export async function deleteAnnouncementComment(commentId: string) {
  const session = await requireAuth();

  const comment = await db.announcementComment.findUnique({
    where: { id: commentId },
    include: { announcement: true },
  });

  if (!comment) throw new Error('Komentar tidak ditemukan');

  if (
    comment.authorId !== session.user.id &&
    !['TEACHER', 'ADMIN', 'SUPER_ADMIN'].includes(session.user.role)
  ) {
    throw new Error('Akses ditolak');
  }

  await db.announcementComment.delete({
    where: { id: commentId },
  });

  revalidatePath(`/teacher/course/${comment.announcement.courseId}/forum`);
  revalidatePath(`/student/course/${comment.announcement.courseId}/forum`);

  return { success: true };
}
