'use server';

import { db } from '@/lib/db';
import { requireRole, hashPassword, verifyPassword } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';

export interface PlatformDashboardData {
  schools: {
    total: number;
    active: number;
    inactive: number;
  };
  users: {
    total: number;
    students: number;
    teachers: number;
    admins: number;
    supervisors: number;
    superAdmins: number;
  };
  learning: {
    totalCourses: number;
    totalQuizAttempts: number;
    totalAssignmentSubmissions: number;
  };
  recentSchools: Array<{
    id: string;
    name: string;
    code: string;
    isActive: boolean;
    createdAt: Date;
    _count: {
      users: number;
      courses: number;
    };
  }>;
}

export async function getPlatformDashboardStats(): Promise<PlatformDashboardData> {
  await requireRole('SUPER_ADMIN');

  const [
    totalSchools,
    activeSchools,
    totalUsers,
    studentsCount,
    teachersCount,
    adminsCount,
    supervisorsCount,
    superAdminsCount,
    totalCourses,
    totalQuizAttempts,
    totalAssignmentSubmissions,
    recentSchools,
  ] = await Promise.all([
    db.school.count(),
    db.school.count({ where: { isActive: true } }),
    db.user.count(),
    db.user.count({ where: { role: Role.STUDENT } }),
    db.user.count({ where: { role: Role.TEACHER } }),
    db.user.count({ where: { role: Role.ADMIN } }),
    db.user.count({ where: { role: Role.SUPERVISOR } }),
    db.user.count({ where: { role: Role.SUPER_ADMIN } }),
    db.course.count(),
    db.quizAttempt.count(),
    db.assignmentSubmission.count(),
    db.school.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            courses: true,
          },
        },
      },
    }),
  ]);

  return {
    schools: {
      total: totalSchools,
      active: activeSchools,
      inactive: totalSchools - activeSchools,
    },
    users: {
      total: totalUsers,
      students: studentsCount,
      teachers: teachersCount,
      admins: adminsCount,
      supervisors: supervisorsCount,
      superAdmins: superAdminsCount,
    },
    learning: {
      totalCourses,
      totalQuizAttempts,
      totalAssignmentSubmissions,
    },
    recentSchools,
  };
}

export interface PlatformUserItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  nis: string | null;
  nip: string | null;
  isActive: boolean;
  schoolId: string | null;
  schoolName: string | null;
  schoolCode: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export async function getPlatformUsers(filter: {
  search?: string;
  schoolId?: string;
  role?: string;
  page?: number;
  limit?: number;
}) {
  await requireRole('SUPER_ADMIN');

  const page = filter.page && filter.page > 0 ? filter.page : 1;
  const limit = filter.limit && filter.limit > 0 ? filter.limit : 20;
  const skip = (page - 1) * limit;

  const whereClause: any = {};

  if (filter.schoolId && filter.schoolId !== 'ALL') {
    whereClause.schoolId = filter.schoolId;
  }

  if (filter.role && filter.role !== 'ALL' && Object.values(Role).includes(filter.role as Role)) {
    whereClause.role = filter.role as Role;
  }

  if (filter.search && filter.search.trim().length > 0) {
    const q = filter.search.trim();
    whereClause.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { nip: { contains: q, mode: 'insensitive' } },
      { nis: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [totalCount, users, schools] = await Promise.all([
    db.user.count({ where: whereClause }),
    db.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        nis: true,
        nip: true,
        isActive: true,
        schoolId: true,
        createdAt: true,
        lastLoginAt: true,
        school: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.school.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const items: PlatformUserItem[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    nis: u.nis,
    nip: u.nip,
    isActive: u.isActive,
    schoolId: u.schoolId,
    schoolName: u.school?.name || null,
    schoolCode: u.school?.code || null,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  }));

  return {
    users: items,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
    schools,
  };
}

export async function createPlatformUser(data: {
  name: string;
  email: string;
  password: string;
  role: Role;
  schoolId?: string;
  nip?: string;
}) {
  await requireRole('SUPER_ADMIN');

  const trimmedEmail = data.email.trim().toLowerCase();
  const trimmedName = data.name.trim();

  if (!trimmedName || !trimmedEmail || !data.password) {
    throw new Error('Nama, email, dan kata sandi wajib diisi');
  }

  if (data.password.length < 6) {
    throw new Error('Kata sandi minimal 6 karakter');
  }

  // Check email uniqueness
  const existingUser = await db.user.findUnique({
    where: { email: trimmedEmail },
  });

  if (existingUser) {
    throw new Error('Email sudah terdaftar pada platform');
  }

  // If role requires school, validate schoolId
  if (data.role !== Role.SUPER_ADMIN && !data.schoolId) {
    throw new Error('Sekolah wajib dipilih untuk peran ini');
  }

  const hashedPassword = hashPassword(data.password);

  const newUser = await db.user.create({
    data: {
      name: trimmedName,
      email: trimmedEmail,
      passwordHash: hashedPassword,
      role: data.role,
      schoolId: data.role === Role.SUPER_ADMIN ? null : data.schoolId,
      nip: data.nip?.trim() || null,
      isActive: true,
      mustChangePassword: true,
    },
  });

  // Assign to UserSchool if schoolId provided
  if (data.schoolId) {
    await db.userSchool.create({
      data: {
        userId: newUser.id,
        schoolId: data.schoolId,
      },
    }).catch(() => {
      // Ignore if exists
    });
  }

  revalidatePath('/[locale]/platform/users', 'page');
  revalidatePath('/[locale]/platform/dashboard', 'page');

  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
  };
}

export async function togglePlatformUserActive(userId: string) {
  const session = await requireRole('SUPER_ADMIN');

  if (userId === session.user.id) {
    throw new Error('Anda tidak dapat menonaktifkan akun Anda sendiri');
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Pengguna tidak ditemukan');

  const updated = await db.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
    select: { id: true, isActive: true, name: true },
  });

  revalidatePath('/[locale]/platform/users', 'page');
  return updated;
}

export async function resetPlatformUserPassword(userId: string, newPassword: string) {
  await requireRole('SUPER_ADMIN');

  if (!newPassword || newPassword.trim().length < 6) {
    throw new Error('Kata sandi baru minimal 6 karakter');
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Pengguna tidak ditemukan');

  const hashedPassword = hashPassword(newPassword.trim());

  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: hashedPassword,
      mustChangePassword: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  revalidatePath('/[locale]/platform/users', 'page');
  return { success: true };
}

export async function getPlatformSettings() {
  const session = await requireRole('SUPER_ADMIN');

  const currentUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  return {
    currentUser,
    platform: {
      name: 'LenteraBelajar LMS',
      version: '1.0.0',
      supportEmail: 'support@lenterabelajar.id',
      maxFailedLogins: 5,
      lockoutDurationMinutes: 15,
      passwordMinLength: 6,
    },
  };
}

export async function updateSuperAdminProfile(data: {
  name: string;
  email: string;
  currentPassword?: string;
  newPassword?: string;
}) {
  const session = await requireRole('SUPER_ADMIN');

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) throw new Error('Pengguna tidak ditemukan');

  const trimmedEmail = data.email.trim().toLowerCase();
  const trimmedName = data.name.trim();

  if (!trimmedName || !trimmedEmail) {
    throw new Error('Nama dan email wajib diisi');
  }

  if (trimmedEmail !== user.email) {
    const existing = await db.user.findUnique({ where: { email: trimmedEmail } });
    if (existing && existing.id !== user.id) {
      throw new Error('Email sudah digunakan oleh pengguna lain');
    }
  }

  let updatedPasswordHash: string | undefined = undefined;

  if (data.newPassword) {
    if (!data.currentPassword) {
      throw new Error('Kata sandi lama wajib diisi untuk mengubah kata sandi');
    }

    const isMatch = verifyPassword(data.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new Error('Kata sandi lama tidak sesuai');
    }

    if (data.newPassword.trim().length < 6) {
      throw new Error('Kata sandi baru minimal 6 karakter');
    }

    updatedPasswordHash = hashPassword(data.newPassword.trim());
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      name: trimmedName,
      email: trimmedEmail,
      ...(updatedPasswordHash ? { passwordHash: updatedPasswordHash } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  revalidatePath('/[locale]/platform/settings', 'page');
  return updated;
}
