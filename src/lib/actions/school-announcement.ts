'use server';

import { db } from '@/lib/db';
import { requireAuth, requireRole, requireSchool } from '@/lib/auth-utils';
import { AnnouncementPriority, AnnouncementTarget, Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getSchoolAnnouncements() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('Sekolah tidak ditemukan');

  return db.schoolAnnouncement.findMany({
    where: { schoolId },
    orderBy: [
      { isPinned: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function createSchoolAnnouncement(data: {
  title: string;
  content: string;
  targetRole?: AnnouncementTarget;
  priority?: AnnouncementPriority;
  isPinned?: boolean;
  expiresAt?: string | null;
  sendNotification?: boolean;
}) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('Sekolah tidak ditemukan');

  if (!data.title.trim() || !data.content.trim()) {
    throw new Error('Judul dan konten pengumuman wajib diisi');
  }

  const targetRole = data.targetRole || AnnouncementTarget.ALL;
  const priority = data.priority || AnnouncementPriority.NORMAL;

  const announcement = await db.schoolAnnouncement.create({
    data: {
      schoolId,
      authorId: session.user.id,
      title: data.title.trim(),
      content: data.content,
      targetRole,
      priority,
      isPinned: Boolean(data.isPinned),
      isActive: true,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });

  // Optional: Broadcast push notification to target users
  if (data.sendNotification) {
    try {
      let roleFilter: Role[] | undefined = undefined;
      if (targetRole === AnnouncementTarget.TEACHER) {
        roleFilter = [Role.TEACHER];
      } else if (targetRole === AnnouncementTarget.STUDENT) {
        roleFilter = [Role.STUDENT];
      }

      const targetUsers = await db.user.findMany({
        where: {
          schoolId,
          isActive: true,
          ...(roleFilter ? { role: { in: roleFilter } } : {}),
        },
        select: { id: true, role: true },
      });

      if (targetUsers.length > 0) {
        const priorityPrefix = priority === AnnouncementPriority.URGENT ? '🚨 [MENDESAK] ' : priority === AnnouncementPriority.IMPORTANT ? '⚠️ [PENTING] ' : '';
        await db.notification.createMany({
          data: targetUsers.map((u) => ({
            userId: u.id,
            title: `${priorityPrefix}${data.title.trim()}`,
            message: 'Pengumuman resmi baru telah diterbitkan oleh pihak sekolah.',
            type: 'school_announcement',
            link: u.role === Role.TEACHER ? '/teacher/dashboard' : '/student/dashboard',
          })),
        });
      }
    } catch (notifErr) {
      console.error('Failed to broadcast notifications for announcement:', notifErr);
    }
  }

  revalidatePath('/[locale]/admin/announcements', 'page');
  revalidatePath('/[locale]/teacher/dashboard', 'page');
  revalidatePath('/[locale]/student/dashboard', 'page');

  return announcement;
}

export async function updateSchoolAnnouncement(
  id: string,
  data: {
    title: string;
    content: string;
    targetRole?: AnnouncementTarget;
    priority?: AnnouncementPriority;
    isPinned?: boolean;
    expiresAt?: string | null;
    isActive?: boolean;
  }
) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('Sekolah tidak ditemukan');

  const updated = await db.schoolAnnouncement.update({
    where: { id, schoolId },
    data: {
      title: data.title.trim(),
      content: data.content,
      targetRole: data.targetRole,
      priority: data.priority,
      isPinned: data.isPinned,
      isActive: data.isActive,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });

  revalidatePath('/[locale]/admin/announcements', 'page');
  revalidatePath('/[locale]/teacher/dashboard', 'page');
  revalidatePath('/[locale]/student/dashboard', 'page');

  return updated;
}

export async function toggleSchoolAnnouncementActive(id: string) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('Sekolah tidak ditemukan');

  const existing = await db.schoolAnnouncement.findUnique({
    where: { id, schoolId },
    select: { isActive: true },
  });

  if (!existing) throw new Error('Pengumuman tidak ditemukan');

  const updated = await db.schoolAnnouncement.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  revalidatePath('/[locale]/admin/announcements', 'page');
  revalidatePath('/[locale]/teacher/dashboard', 'page');
  revalidatePath('/[locale]/student/dashboard', 'page');

  return updated;
}

export async function deleteSchoolAnnouncement(id: string) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('Sekolah tidak ditemukan');

  await db.schoolAnnouncement.delete({
    where: { id, schoolId },
  });

  revalidatePath('/[locale]/admin/announcements', 'page');
  revalidatePath('/[locale]/teacher/dashboard', 'page');
  revalidatePath('/[locale]/student/dashboard', 'page');

  return { success: true };
}

export async function getActiveSchoolAnnouncementsForUser() {
  const session = await requireAuth();
  const schoolId = session.user.schoolId;
  if (!schoolId) return [];

  const now = new Date();
  const userRole = session.user.role;

  // Determine target roles that apply to this user
  const applicableTargets: AnnouncementTarget[] = [AnnouncementTarget.ALL];
  if (userRole === Role.TEACHER) {
    applicableTargets.push(AnnouncementTarget.TEACHER);
  } else if (userRole === Role.STUDENT) {
    applicableTargets.push(AnnouncementTarget.STUDENT);
  } else if (userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN || userRole === Role.SUPERVISOR) {
    applicableTargets.push(AnnouncementTarget.TEACHER, AnnouncementTarget.STUDENT);
  }

  return db.schoolAnnouncement.findMany({
    where: {
      schoolId,
      isActive: true,
      targetRole: { in: applicableTargets },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    orderBy: [
      { priority: 'desc' }, // URGENT first
      { isPinned: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      author: {
        select: {
          name: true,
        },
      },
    },
  });
}
