'use server';

import { db } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';

export interface ForumCommentItem {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorAvatar: string | null;
  parentId: string | null;
  content: string;
  isAnswer: boolean;
  createdAt: Date;
  replies?: ForumCommentItem[];
}

export interface ForumThreadItem {
  id: string;
  courseId: string;
  moduleId: string | null;
  moduleTitle?: string | null;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorAvatar: string | null;
  title: string;
  content: string;
  isPinned: boolean;
  isSolved: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    comments: number;
  };
}

export async function getCourseForumThreads(
  courseId: string,
  moduleId?: string
): Promise<ForumThreadItem[]> {
  await requireAuth();

  const whereClause: any = { courseId };
  if (moduleId && moduleId !== 'ALL') {
    whereClause.moduleId = moduleId;
  }

  const threads = await db.forumThread.findMany({
    where: whereClause,
    orderBy: [
      { isPinned: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      author: {
        select: { id: true, name: true, role: true, avatar: true },
      },
      module: {
        select: { id: true, title: true },
      },
      _count: {
        select: { comments: true },
      },
    },
  });

  return threads.map((t) => ({
    id: t.id,
    courseId: t.courseId,
    moduleId: t.moduleId,
    moduleTitle: t.module?.title || null,
    authorId: t.authorId,
    authorName: t.author.name,
    authorRole: t.author.role,
    authorAvatar: t.author.avatar,
    title: t.title,
    content: t.content,
    isPinned: t.isPinned,
    isSolved: t.isSolved,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    _count: t._count,
  }));
}

export async function getForumThreadDetail(threadId: string) {
  await requireAuth();

  const thread = await db.forumThread.findUnique({
    where: { id: threadId },
    include: {
      author: {
        select: { id: true, name: true, role: true, avatar: true },
      },
      module: {
        select: { id: true, title: true },
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

  if (!thread) return null;

  // Build nested comments tree
  const commentMap = new Map<string, any>();
  const rootComments: any[] = [];

  for (const c of thread.comments) {
    const formattedComment = {
      id: c.id,
      threadId: c.threadId,
      authorId: c.authorId,
      authorName: c.author.name,
      authorRole: c.author.role,
      authorAvatar: c.author.avatar,
      parentId: c.parentId,
      content: c.content,
      isAnswer: c.isAnswer,
      createdAt: c.createdAt,
      replies: [],
    };
    commentMap.set(c.id, formattedComment);
  }

  for (const c of thread.comments) {
    const current = commentMap.get(c.id);
    if (c.parentId && commentMap.has(c.parentId)) {
      commentMap.get(c.parentId).replies.push(current);
    } else {
      rootComments.push(current);
    }
  }

  return {
    ...thread,
    authorName: thread.author.name,
    authorRole: thread.author.role,
    authorAvatar: thread.author.avatar,
    moduleTitle: thread.module?.title || null,
    rootComments,
  };
}

export async function createForumThread(data: {
  courseId: string;
  moduleId?: string;
  title: string;
  content: string;
}) {
  const session = await requireAuth();

  if (!data.title || !data.title.trim()) {
    throw new Error('Judul diskusi tidak boleh kosong');
  }
  if (!data.content || !data.content.trim()) {
    throw new Error('Isi diskusi tidak boleh kosong');
  }

  const course = await db.course.findUnique({
    where: { id: data.courseId },
    select: { id: true, teacherId: true, title: true },
  });

  if (!course) throw new Error('Kursus tidak ditemukan');

  const thread = await db.forumThread.create({
    data: {
      courseId: data.courseId,
      moduleId: data.moduleId && data.moduleId !== 'ALL' ? data.moduleId : null,
      authorId: session.user.id,
      title: data.title.trim(),
      content: data.content.trim(),
      isPinned: false,
    },
  });

  // If student started discussion, notify teacher
  if (session.user.id !== course.teacherId) {
    await db.notification.create({
      data: {
        userId: course.teacherId,
        title: `Pertanyaan Baru: ${course.title}`,
        message: `${session.user.name} bertanya: "${data.title}"`,
        type: 'FORUM_THREAD',
        link: `/teacher/course/${course.id}/forum?threadId=${thread.id}`,
      },
    });
  }

  revalidatePath(`/teacher/course/${data.courseId}/forum`);
  revalidatePath(`/student/course/${data.courseId}/forum`);
  return thread;
}

export async function addForumComment(data: {
  threadId: string;
  content: string;
  parentId?: string;
}) {
  const session = await requireAuth();

  if (!data.content || !data.content.trim()) {
    throw new Error('Balasan tidak boleh kosong');
  }

  const thread = await db.forumThread.findUnique({
    where: { id: data.threadId },
    include: {
      course: { select: { id: true, teacherId: true, title: true } },
    },
  });

  if (!thread) throw new Error('Topik diskusi tidak ditemukan');

  const comment = await db.forumComment.create({
    data: {
      threadId: data.threadId,
      authorId: session.user.id,
      parentId: data.parentId || null,
      content: data.content.trim(),
    },
    include: {
      author: {
        select: { id: true, name: true, role: true, avatar: true },
      },
    },
  });

  // Notify thread author if someone else replied
  if (thread.authorId !== session.user.id) {
    const isTeacher = session.user.role === 'TEACHER';
    const targetLink = isTeacher
      ? `/student/course/${thread.courseId}/forum?threadId=${thread.id}`
      : `/teacher/course/${thread.courseId}/forum?threadId=${thread.id}`;

    await db.notification.create({
      data: {
        userId: thread.authorId,
        title: `Tanggapan pada Diskusi: ${thread.title}`,
        message: `${session.user.name} membalas diskusi Anda.`,
        type: 'FORUM_REPLY',
        link: targetLink,
      },
    });
  }

  revalidatePath(`/teacher/course/${thread.courseId}/forum`);
  revalidatePath(`/student/course/${thread.courseId}/forum`);
  return comment;
}

export async function markCommentAsAnswer(threadId: string, commentId: string) {
  const session = await requireAuth();

  const thread = await db.forumThread.findUnique({
    where: { id: threadId },
    include: { course: { select: { teacherId: true } } },
  });

  if (!thread) throw new Error('Topik diskusi tidak ditemukan');

  const canMark =
    session.user.id === thread.course.teacherId ||
    session.user.id === thread.authorId ||
    ['ADMIN', 'SUPER_ADMIN'].includes(session.user.role);

  if (!canMark) {
    throw new Error('Hanya guru pengampu atau pembuat thread yang dapat menandai jawaban terpilih');
  }

  // Reset any existing answer on this thread
  await db.forumComment.updateMany({
    where: { threadId },
    data: { isAnswer: false },
  });

  // Mark this comment
  await db.forumComment.update({
    where: { id: commentId },
    data: { isAnswer: true },
  });

  // Mark thread as solved
  await db.forumThread.update({
    where: { id: threadId },
    data: { isSolved: true },
  });

  revalidatePath(`/teacher/course/${thread.courseId}/forum`);
  revalidatePath(`/student/course/${thread.courseId}/forum`);
  return { success: true };
}

export async function togglePinForumThread(threadId: string) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const thread = await db.forumThread.findUnique({
    where: { id: threadId },
  });

  if (!thread) throw new Error('Diskusi tidak ditemukan');

  const updated = await db.forumThread.update({
    where: { id: threadId },
    data: { isPinned: !thread.isPinned },
  });

  revalidatePath(`/teacher/course/${updated.courseId}/forum`);
  revalidatePath(`/student/course/${updated.courseId}/forum`);
  return updated;
}

export async function deleteForumThread(threadId: string) {
  const session = await requireAuth();

  const thread = await db.forumThread.findUnique({
    where: { id: threadId },
    include: { course: { select: { teacherId: true } } },
  });

  if (!thread) throw new Error('Diskusi tidak ditemukan');

  const canDelete =
    thread.authorId === session.user.id ||
    thread.course.teacherId === session.user.id ||
    ['ADMIN', 'SUPER_ADMIN'].includes(session.user.role);

  if (!canDelete) {
    throw new Error('Akses ditolak untuk menghapus diskusi ini');
  }

  await db.forumThread.delete({
    where: { id: threadId },
  });

  revalidatePath(`/teacher/course/${thread.courseId}/forum`);
  revalidatePath(`/student/course/${thread.courseId}/forum`);
  return { success: true };
}

export async function deleteForumComment(commentId: string) {
  const session = await requireAuth();

  const comment = await db.forumComment.findUnique({
    where: { id: commentId },
    include: {
      thread: {
        include: { course: { select: { teacherId: true } } },
      },
    },
  });

  if (!comment) throw new Error('Komentar tidak ditemukan');

  const canDelete =
    comment.authorId === session.user.id ||
    comment.thread.course.teacherId === session.user.id ||
    ['ADMIN', 'SUPER_ADMIN'].includes(session.user.role);

  if (!canDelete) {
    throw new Error('Akses ditolak');
  }

  await db.forumComment.delete({
    where: { id: commentId },
  });

  revalidatePath(`/teacher/course/${comment.thread.courseId}/forum`);
  revalidatePath(`/student/course/${comment.thread.courseId}/forum`);
  return { success: true };
}
