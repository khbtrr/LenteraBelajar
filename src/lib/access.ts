import 'server-only';
import { db } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/auth-utils';
import type { AccessItemType } from '@prisma/client';

export async function assertCourseAccess(courseId: string, mode: 'read' | 'manage' | 'roster' = 'read') {
  const session = await requireAuth();
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, schoolId: true, teacherId: true, isCrossSchool: true },
  });
  if (!course) throw new Error('Course tidak ditemukan');
  const { role, id, schoolId } = session.user;
  if (role === 'SUPER_ADMIN') return { session, course };
  if (role === 'ADMIN' && schoolId === course.schoolId) return { session, course };
  if (role === 'SUPERVISOR' && mode !== 'manage' && schoolId === course.schoolId) return { session, course };
  if (role === 'TEACHER' && course.teacherId === id) return { session, course };
  if (role === 'STUDENT' && mode === 'read') {
    const enrollment = await db.enrollment.findUnique({
      where: { courseId_userId: { courseId, userId: id } },
      select: { id: true },
    });
    if (enrollment && (course.schoolId === schoolId || course.isCrossSchool)) return { session, course };
  }
  throw new Error('Akses ditolak: Anda tidak memiliki akses ke course ini');
}

export async function assertModuleAccess(moduleId: string, mode: 'read' | 'manage' | 'roster' = 'read') {
  const courseModule = await db.module.findUnique({ where: { id: moduleId }, select: { courseId: true } });
  if (!courseModule) throw new Error('Modul tidak ditemukan');
  return assertCourseAccess(courseModule.courseId, mode);
}

export async function assertItemAccess(itemType: AccessItemType, itemId: string, mode: 'read' | 'manage' = 'read') {
  const item = itemType === 'QUIZ'
    ? await db.quiz.findUnique({ where: { id: itemId }, select: { moduleId: true, isPublished: true, isRemedial: true, targetStudentIds: true } })
    : itemType === 'ASSIGNMENT'
      ? await db.assignment.findUnique({ where: { id: itemId }, select: { moduleId: true, isPublished: true } })
      : await db.content.findUnique({ where: { id: itemId }, select: { moduleId: true } });
  if (!item) throw new Error('Konten tidak ditemukan');
  const access = await assertModuleAccess(item.moduleId, mode);
  if (access.session.user.role === 'STUDENT' && 'isPublished' in item && !item.isPublished) {
    throw new Error('Akses ditolak: Konten belum diterbitkan');
  }
  if (access.session.user.role === 'STUDENT') {
    const userId = access.session.user.id;
    if ('isRemedial' in item && item.isRemedial && 'targetStudentIds' in item && Array.isArray(item.targetStudentIds) && !item.targetStudentIds.includes(userId)) {
      throw new Error('Akses ditolak: Anda bukan peserta remedial');
    }
    const grants = itemType === 'QUIZ' ? await db.quizCohortAccess.findMany({ where: { quizId: itemId }, select: { cohortId: true } })
      : itemType === 'ASSIGNMENT' ? await db.assignmentCohortAccess.findMany({ where: { assignmentId: itemId }, select: { cohortId: true } })
        : await db.contentCohortAccess.findMany({ where: { contentId: itemId }, select: { cohortId: true } });
    if (grants.length) {
      const ids = grants.map((grant) => grant.cohortId);
      const [enrollment, membership, override] = await Promise.all([
        db.enrollment.findUnique({ where: { courseId_userId: { courseId: access.course.id, userId } }, select: { cohortId: true } }),
        db.cohortMember.findFirst({ where: { userId, cohortId: { in: ids } }, select: { id: true } }),
        db.itemAccessOverride.findUnique({ where: { itemType_itemId_userId: { itemType, itemId, userId } }, select: { id: true } }),
      ]);
      if (!override && !membership && (!enrollment?.cohortId || !ids.includes(enrollment.cohortId))) {
        throw new Error('Akses ditolak: Konten tidak tersedia untuk rombel Anda');
      }
    }
  }
  return access;
}

export async function assertSchoolResource(model: 'cohort' | 'category' | 'academicYear', id: string) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const args = { where: { id }, select: { id: true, schoolId: true } } as const;
  const resource = model === 'cohort' ? await db.cohort.findUnique(args)
    : model === 'category' ? await db.category.findUnique(args) : await db.academicYear.findUnique(args);
  if (!resource || (session.user.role !== 'SUPER_ADMIN' && resource.schoolId !== session.user.schoolId)) {
    throw new Error('Akses ditolak: Data tidak berada dalam sekolah Anda');
  }
  return { session, resource };
}

export async function assertSchoolStudent(userId: string, schoolId: string, allowCrossSchool = false) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true, schoolId: true, isActive: true } });
  if (!user || user.role !== 'STUDENT' || !user.isActive || (!allowCrossSchool && user.schoolId !== schoolId)) {
    throw new Error('Akses ditolak: Siswa tidak berada dalam sekolah tujuan');
  }
}

export async function assertBankResource(kind: 'question' | 'category', id: string, mode: 'read' | 'manage' = 'manage') {
  const args = { where: { id }, select: { courseId: true } } as const;
  const resource = kind === 'question' ? await db.questionBank.findUnique(args) : await db.questionBankCategory.findUnique(args);
  if (!resource) throw new Error('Bank soal tidak ditemukan');
  return assertCourseAccess(resource.courseId, mode === 'read' ? 'roster' : 'manage');
}

export async function assertAcademicReferences(schoolId: string, data: {
  academicYearId?: string; categoryId?: string | null; teacherId?: string | null;
}) {
  if (data.academicYearId && !await db.academicYear.findFirst({ where: { id: data.academicYearId, schoolId } })) {
    throw new Error('Tahun ajaran tidak berada dalam sekolah tujuan');
  }
  if (data.categoryId && !await db.category.findFirst({ where: { id: data.categoryId, schoolId } })) {
    throw new Error('Kategori tidak berada dalam sekolah tujuan');
  }
  if (data.teacherId && !await db.user.findFirst({ where: {
    id: data.teacherId, role: 'TEACHER', isActive: true,
    OR: [{ schoolId }, { assignedSchools: { some: { schoolId } } }],
  } })) throw new Error('Guru tidak ditugaskan ke sekolah tujuan');
}
