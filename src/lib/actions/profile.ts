'use server';

import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-utils';
import { compare, hash } from 'bcryptjs';
import { revalidatePath } from 'next/cache';

export interface UserProfileData {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  nis: string | null;
  nip: string | null;
  createdAt: Date;
  school: {
    id: string;
    name: string;
    code: string;
    logo: string | null;
  } | null;
  // Student gamification & academic
  xp: number;
  level: number;
  streakDays: number;
  cohort: string | null;
  enrolledCourses: {
    id: string;
    title: string;
    teacherName: string;
  }[];
  achievements: {
    id: string;
    badgeCode: string;
    badgeName: string;
    badgeCategory: string;
    icon: string;
    unlockedAt: Date;
  }[];
  // Teacher academic
  taughtCourses: {
    id: string;
    title: string;
    studentCount: number;
    moduleCount: number;
  }[];
  totalStudentsTaught: number;
}

/**
 * Fetch detailed profile data for the authenticated user
 */
export async function getUserProfile(): Promise<UserProfileData> {
  const session = await requireAuth();
  const userId = session.user.id;

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      school: {
        select: {
          id: true,
          name: true,
          code: true,
          logo: true,
        },
      },
      cohortMemberships: {
        include: {
          cohort: {
            select: {
              name: true,
            },
          },
        },
      },
      enrollments: {
        include: {
          course: {
            select: {
              id: true,
              title: true,
              teacher: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      achievements: {
        orderBy: { unlockedAt: 'desc' },
        select: {
          id: true,
          badgeCode: true,
          badgeName: true,
          badgeCategory: true,
          icon: true,
          unlockedAt: true,
        },
      },
      teacherCourses: {
        select: {
          id: true,
          title: true,
          _count: {
            select: {
              enrollments: true,
              modules: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new Error('Pengguna tidak ditemukan');
  }

  const cohortName = user.cohortMemberships[0]?.cohort.name ?? null;

  const enrolledCourses = user.enrollments.map((e) => ({
    id: e.course.id,
    title: e.course.title,
    teacherName: e.course.teacher.name,
  }));

  const taughtCourses = user.teacherCourses.map((c) => ({
    id: c.id,
    title: c.title,
    studentCount: c._count.enrollments,
    moduleCount: c._count.modules,
  }));

  const totalStudentsTaught = taughtCourses.reduce((acc, c) => acc + c.studentCount, 0);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    nis: user.nis,
    nip: user.nip,
    createdAt: user.createdAt,
    school: user.school,
    xp: user.xp,
    level: user.level,
    streakDays: user.streakDays,
    cohort: cohortName,
    enrolledCourses,
    achievements: user.achievements,
    taughtCourses,
    totalStudentsTaught,
  };
}

/**
 * Update general profile information (Name and Avatar)
 */
export async function updateUserProfile(data: {
  name?: string;
  avatar?: string | null;
}): Promise<{ success: boolean; name?: string; avatar?: string | null }> {
  const session = await requireAuth();
  const userId = session.user.id;

  const updateData: { name?: string; avatar?: string | null } = {};

  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (!trimmed || trimmed.length < 2) {
      throw new Error('Nama lengkap minimal harus 2 karakter');
    }
    if (trimmed.length > 100) {
      throw new Error('Nama lengkap maksimal 100 karakter');
    }
    updateData.name = trimmed;
  }

  if (data.avatar !== undefined) {
    updateData.avatar = data.avatar;
  }

  await db.user.update({
    where: { id: userId },
    data: updateData,
  });

  revalidatePath('/profile');
  revalidatePath('/', 'layout');

  return { success: true, ...updateData };
}

/**
 * Remove user avatar (sets to null)
 */
export async function removeUserAvatar(): Promise<{ success: boolean }> {
  const session = await requireAuth();
  const userId = session.user.id;

  await db.user.update({
    where: { id: userId },
    data: { avatar: null },
  });

  revalidatePath('/profile');
  revalidatePath('/', 'layout');

  return { success: true };
}

/**
 * Change user password with current password verification
 */
export async function changeUserPassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean }> {
  const session = await requireAuth();
  const userId = session.user.id;

  const { currentPassword, newPassword } = data;

  if (!currentPassword || !newPassword) {
    throw new Error('Kata sandi saat ini dan kata sandi baru harus diisi');
  }

  if (newPassword.length < 8) {
    throw new Error('Kata sandi baru minimal harus 8 karakter');
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) {
    throw new Error('Pengguna tidak ditemukan');
  }

  const isCurrentPasswordValid = await compare(currentPassword, user.passwordHash);
  if (!isCurrentPasswordValid) {
    throw new Error('Kata sandi saat ini tidak tepat');
  }

  const hashedNewPassword = await hash(newPassword, 12);

  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: hashedNewPassword,
      mustChangePassword: false,
    },
  });

  return { success: true };
}
