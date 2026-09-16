'use server';

import { db } from '@/lib/db';
import { requireAuth, requireSchool, requireRole } from '@/lib/auth-utils';
import { CourseStatus, CourseRequestStatus, Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { createNotification } from './notification';

export async function getCourses(filters?: {
  status?: CourseStatus;
  teacherId?: string;
  academicYearId?: string;
}) {
  const session = await requireSchool();
  return db.course.findMany({
    where: {
      schoolId: session.schoolId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.teacherId && { teacherId: filters.teacherId }),
      ...(filters?.academicYearId && { academicYearId: filters.academicYearId }),
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
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTeachersInSchool() {
  const session = await requireSchool();
  return db.user.findMany({
    where: {
      schoolId: session.schoolId,
      role: Role.TEACHER,
      isActive: true,
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
  const session = await requireAuth();
  return db.course.findUnique({
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
}

export async function createCourse(data: {
  title: string;
  description?: string;
  categoryId?: string;
  academicYearId: string;
  teacherId?: string;
}) {
  const session = await requireSchool();
  const teacherId = data.teacherId || session.user.id;

  const course = await db.course.create({
    data: {
      title: data.title,
      description: data.description,
      categoryId: data.categoryId || null,
      academicYearId: data.academicYearId,
      teacherId,
      schoolId: session.schoolId,
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

export async function reviewCourseRequest(
  requestId: string,
  action: 'APPROVE' | 'REJECT',
  adminNote?: string
) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  const request = await db.courseRequest.findUnique({
    where: { id: requestId, schoolId },
  });

  if (!request) throw new Error('Request not found');

  if (action === 'APPROVE') {
    // Create the actual Course
    const course = await db.course.create({
      data: {
        title: request.title,
        description: request.description,
        categoryId: request.categoryId,
        academicYearId: request.academicYearId,
        teacherId: request.requesterId,
        schoolId,
        status: CourseStatus.ACTIVE,
      },
    });

    await db.courseRequest.update({
      where: { id: requestId },
      data: {
        status: CourseRequestStatus.APPROVED,
        courseId: course.id,
        adminNote: adminNote || null,
      },
    });

    // Notify Teacher
    await createNotification({
      userId: request.requesterId,
      title: 'Course Disetujui!',
      message: `Course "${request.title}" telah disetujui dan aktif.`,
      type: 'course_approved',
      link: `/teacher/my-courses`,
    });
  } else {
    await db.courseRequest.update({
      where: { id: requestId },
      data: {
        status: CourseRequestStatus.REJECTED,
        adminNote: adminNote || null,
      },
    });

    // Notify Teacher
    await createNotification({
      userId: request.requesterId,
      title: 'Course Ditolak',
      message: `Pengajuan course "${request.title}" ditolak.${adminNote ? ` Catatan: ${adminNote}` : ''}`,
      type: 'course_rejected',
      link: `/teacher/request-course`,
    });
  }

  revalidatePath('/[locale]/admin/course-requests', 'page');
  revalidatePath('/[locale]/admin/courses', 'page');
  revalidatePath('/[locale]/admin/dashboard', 'page');
  revalidatePath('/[locale]/teacher/my-courses', 'page');
}
