'use server';

import { db } from '@/lib/db';
import { requireAuth, requireSchool, requireRole } from '@/lib/auth-utils';
import { CourseStatus, CourseRequestStatus, Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '@/lib/notifications';
import { assertCourseAccess, assertAcademicReferences } from '@/lib/access';
import { getCourseModules } from '@/lib/actions/module';
import { recordAuditLog } from '@/lib/audit-log';

export async function getCourses(filters?: {
  status?: CourseStatus;
  teacherId?: string;
  academicYearId?: string;
}) {
  const session = await requireSchool();
  const isStudent = session.user.role === Role.STUDENT;

  return db.course.findMany({
    where: {
      OR: [
        { schoolId: session.schoolId },
        { isCrossSchool: true },
      ],
      ...(isStudent
        ? {
            status: CourseStatus.ACTIVE,
            enrollments: { some: { userId: session.user.id } },
          }
        : {
            ...(filters?.status && { status: filters.status }),
            ...(filters?.teacherId && { teacherId: filters.teacherId }),
          }),
      ...(filters?.academicYearId && { academicYearId: filters.academicYearId }),
    },
    include: {
      teacher: { select: { id: true, name: true, ...(isStudent ? {} : { email: true }) } },
      category: { select: { id: true, name: true } },
      academicYear: { select: { id: true, name: true, status: true } },
      school: { select: { id: true, name: true, code: true } },
      _count: {
        select: {
          enrollments: true,
          modules: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTeachersInSchool() {
  const session = await requireSchool();
  return db.user.findMany({
    where: {
      role: Role.TEACHER,
      isActive: true,
      OR: [
        { schoolId: session.schoolId },
        { assignedSchools: { some: { schoolId: session.schoolId } } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: 'asc' },
  });
}

export async function getCourseById(courseId: string) {
  const { session } = await assertCourseAccess(courseId);
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      category: { select: { id: true, name: true } },
      academicYear: { select: { id: true, name: true, status: true } },
      modules: {
        include: {
          contents: true,
          quizzes: true,
          assignments: true,
        },
        orderBy: { order: 'asc' },
      },
      enrollments: {
        include: {
          user: { select: { id: true, name: true, email: true, nis: true } },
          cohort: { select: { id: true, name: true } },
        },
      },
      _count: {
        select: {
          enrollments: true,
          modules: true,
        },
      },
    },
  });

  if (!course) return null;

  if (session.user.role === 'STUDENT') {
    course.modules = await getCourseModules(courseId);

    course.enrollments = course.enrollments.filter((e) => e.userId === session.user.id);
  }

  return course;
}

export async function createCourse(data: {
  title: string;
  description?: string;
  categoryId?: string;
  academicYearId: string;
  teacherId?: string;
  isCrossSchool?: boolean;
}) {
  const session = await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  const teacherId = session.user.role === 'TEACHER' ? session.user.id : (data.teacherId || session.user.id);
  await assertAcademicReferences(schoolId, { ...data, teacherId });

  const course = await db.course.create({
    data: {
      title: data.title,
      description: data.description,
      categoryId: data.categoryId || null,
      academicYearId: data.academicYearId,
      teacherId,
      schoolId,
      isCrossSchool: session.user.role === 'SUPER_ADMIN' ? Boolean(data.isCrossSchool) : false,
      status: CourseStatus.ACTIVE,
    },
  });

  revalidatePath('/[locale]/admin/courses', 'page');
  revalidatePath('/[locale]/teacher/my-courses', 'page');
  return course;
}

export async function requestCourse(data: {
  title: string;
  description?: string;
  categoryId?: string;
  academicYearId: string;
}) {
  const session = await requireRole('TEACHER', 'ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');
  await assertAcademicReferences(schoolId, data);

  const courseRequest = await db.courseRequest.create({
    data: {
      title: data.title,
      description: data.description,
      categoryId: data.categoryId || null,
      academicYearId: data.academicYearId,
      requesterId: session.user.id,
      schoolId,
      status: CourseRequestStatus.PENDING,
    },
  });

  // Notify Admins in this school
  const admins = await db.user.findMany({
    where: {
      schoolId,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      title: 'Pengajuan Course Baru',
      message: `${session.user.name} mengajukan course "${data.title}"`,
      type: 'course_request',
      link: '/admin/course-requests',
    });
  }

  revalidatePath('/[locale]/teacher/request-course', 'page');
  revalidatePath('/[locale]/admin/course-requests', 'page');
  return courseRequest;
}

export async function getCourseRequests() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  return db.courseRequest.findMany({
    where: { schoolId },
    include: {
      requester: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTeacherCourseRequests() {
  const session = await requireAuth();
  return db.courseRequest.findMany({
    where: { requesterId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });
}

export async function reviewCourseRequest(requestId: string, action: 'APPROVE' | 'REJECT', adminNote?: string) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId || !['APPROVE', 'REJECT'].includes(action)) throw new Error('Permintaan review tidak valid');
  const outcome = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "CourseRequest" WHERE "id" = ${requestId} FOR UPDATE`;
    const request = await tx.courseRequest.findUnique({ where: { id: requestId, schoolId } });
    if (!request) throw new Error('Request not found');
    const status = action === 'APPROVE' ? CourseRequestStatus.APPROVED : CourseRequestStatus.REJECTED;
    if (request.status === status) return { request, changed: false };
    if (request.status !== CourseRequestStatus.PENDING) throw new Error('Pengajuan sudah diputuskan');
    let courseId: string | null = null;
    if (action === 'APPROVE') {
      const teacher = await tx.user.findFirst({ where: { id: request.requesterId, role: 'TEACHER', isActive: true, OR: [{ schoolId }, { assignedSchools: { some: { schoolId } } }] } });
      const year = await tx.academicYear.findFirst({ where: { id: request.academicYearId, schoolId } });
      const category = request.categoryId ? await tx.category.findFirst({ where: { id: request.categoryId, schoolId } }) : true;
      if (!teacher || !year || !category) throw new Error('Relasi akademik pengajuan tidak valid');
      const course = await tx.course.create({ data: {
        title: request.title, description: request.description, categoryId: request.categoryId,
        academicYearId: request.academicYearId, teacherId: request.requesterId, schoolId, status: 'ACTIVE',
      } });
      courseId = course.id;
    }
    const updated = await tx.courseRequest.update({ where: { id: requestId, status: 'PENDING' }, data: { status, courseId, adminNote: adminNote ?? null } });
    return { request: updated, changed: true };
  });
  if (outcome.changed) await createNotification({
    userId: outcome.request.requesterId, title: action === 'APPROVE' ? 'Course Disetujui' : 'Course Ditolak',
    message: outcome.request.title, type: action === 'APPROVE' ? 'course_approved' : 'course_rejected',
    link: '/teacher/my-courses',
  });
  revalidatePath('/[locale]/admin/course-requests', 'page');
  revalidatePath('/[locale]/admin/courses', 'page');
  revalidatePath('/[locale]/teacher/my-courses', 'page');
  return { success: true, status: outcome.request.status, courseId: outcome.request.courseId };
}

export async function updateCourse(
  courseId: string,
  data: {
    title: string;
    description?: string | null;
    categoryId?: string | null;
    academicYearId: string;
    teacherId: string;
    status: CourseStatus;
    isCrossSchool?: boolean;
  }
) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  const existing = await db.course.findUnique({
    where: { id: courseId, schoolId },
  });
  if (!existing) throw new Error('Course tidak ditemukan');
  if (data.isCrossSchool !== undefined && data.isCrossSchool !== existing.isCrossSchool && session.user.role !== 'SUPER_ADMIN') {
    throw new Error('Akses ditolak: Hanya Super Admin dapat menerbitkan course lintas sekolah');
  }
  await assertAcademicReferences(schoolId, data);

  const updated = await db.course.update({
    where: { id: courseId },
    data: {
      title: data.title,
      description: data.description || null,
      categoryId: data.categoryId || null,
      academicYearId: data.academicYearId,
      teacherId: data.teacherId,
      status: data.status,
      ...(data.isCrossSchool !== undefined && { isCrossSchool: Boolean(data.isCrossSchool) }),
    },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      category: { select: { id: true, name: true } },
      academicYear: { select: { id: true, name: true, status: true } },
      _count: {
        select: {
          enrollments: true,
          modules: true,
        },
      },
    },
  });

  revalidatePath('/[locale]/admin/courses', 'page');
  revalidatePath('/[locale]/admin/dashboard', 'page');
  revalidatePath('/[locale]/teacher/my-courses', 'page');
  return updated;
}

export async function toggleArchiveCourse(courseId: string) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  const existing = await db.course.findUnique({
    where: { id: courseId, schoolId },
    select: { id: true, status: true, title: true },
  });
  if (!existing) throw new Error('Course tidak ditemukan');

  const newStatus = existing.status === CourseStatus.ARCHIVED ? CourseStatus.ACTIVE : CourseStatus.ARCHIVED;

  const updated = await db.course.update({
    where: { id: courseId },
    data: { status: newStatus },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      category: { select: { id: true, name: true } },
      academicYear: { select: { id: true, name: true, status: true } },
      _count: {
        select: {
          enrollments: true,
          modules: true,
        },
      },
    },
  });

  revalidatePath('/[locale]/admin/courses', 'page');
  revalidatePath('/[locale]/admin/dashboard', 'page');
  revalidatePath('/[locale]/teacher/my-courses', 'page');
  return updated;
}

export async function deleteCourse(courseId: string, force = false) {
  try {
    const session = await requireRole('ADMIN', 'SUPER_ADMIN');
    const schoolId = session.user.schoolId;
    if (!schoolId && session.user.role !== 'SUPER_ADMIN') {
      return { success: false, error: 'Tidak ada sekolah aktif yang dipilih.' };
    }

    const course = await db.course.findUnique({
      where: { id: courseId },
      include: {
        _count: {
          select: {
            enrollments: true,
            modules: true,
            grades: true,
            attendanceSessions: true,
            forumThreads: true,
          },
        },
      },
    });

    if (!course) {
      return { success: false, error: 'Course tidak ditemukan.' };
    }

    if (session.user.role !== 'SUPER_ADMIN' && course.schoolId !== schoolId) {
      return { success: false, error: 'Akses ditolak: Kelas tidak berada dalam sekolah Anda.' };
    }

    const hasHistory =
      course._count.enrollments > 0 ||
      course._count.modules > 0 ||
      course._count.grades > 0 ||
      course._count.attendanceSessions > 0 ||
      course._count.forumThreads > 0;

    if (hasHistory && !force) {
      return {
        success: false,
        requiresForce: true,
        stats: {
          enrollments: course._count.enrollments,
          modules: course._count.modules,
          grades: course._count.grades,
        },
        error:
          'Course tidak dapat dihapus karena sudah memiliki siswa terdaftar, modul pembelajaran, atau riwayat nilai.',
      };
    }

    // Putuskan referensi courseRequest jika ada
    await db.courseRequest.updateMany({
      where: { courseId },
      data: { courseId: null },
    });

    await db.course.delete({
      where: { id: courseId },
    });

    await recordAuditLog({
      action: 'COURSE_DELETED',
      userId: session.user.id,
      userEmail: session.user.email,
      details: `Course "${course.title}" (${course.id}) permanently deleted by ${session.user.email}${force ? ' (Force cascade)' : ''}`,
    });

    revalidatePath('/[locale]/admin/courses', 'page');
    revalidatePath('/[locale]/admin/dashboard', 'page');
    revalidatePath('/[locale]/teacher/my-courses', 'page');
    return { success: true };
  } catch (err: any) {
    console.error('deleteCourse error:', err);
    return { success: false, error: err?.message || 'Gagal menghapus course.' };
  }
}
