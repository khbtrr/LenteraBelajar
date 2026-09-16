'use server';

import { db } from '@/lib/db';
import { requireSchool, requireRole, hashPassword } from '@/lib/auth-utils';
import { EnrollmentMethod, Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getCohorts() {
  const session = await requireSchool();
  return db.cohort.findMany({
    where: { schoolId: session.schoolId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, nis: true },
          },
        },
      },
      _count: {
        select: {
          members: true,
          enrollments: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCohortById(id: string) {
  const session = await requireSchool();
  return db.cohort.findUnique({
    where: { id, schoolId: session.schoolId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, nis: true },
          },
        },
      },
    },
  });
}

export async function createCohort(name: string) {
  const session = await requireRole('ADMIN', 'TEACHER', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  const cohort = await db.cohort.create({
    data: {
      name,
      schoolId,
    },
  });

  revalidatePath('/[locale]/admin/cohorts', 'page');
  return cohort;
}

export async function addStudentToCohort(cohortId: string, userId: string) {
  await requireRole('ADMIN', 'TEACHER', 'SUPER_ADMIN');

  const membership = await db.cohortMember.upsert({
    where: {
      cohortId_userId: {
        cohortId,
        userId,
      },
    },
    create: {
      cohortId,
      userId,
    },
    update: {},
  });

  revalidatePath('/[locale]/admin/cohorts', 'page');
  return membership;
}

export async function removeStudentFromCohort(cohortId: string, userId: string) {
  await requireRole('ADMIN', 'TEACHER', 'SUPER_ADMIN');

  const deleted = await db.cohortMember.delete({
    where: {
      cohortId_userId: {
        cohortId,
        userId,
      },
    },
  });

  revalidatePath('/[locale]/admin/cohorts', 'page');
  return deleted;
}

export async function getStudentsInSchool() {
  const session = await requireSchool();
  return db.user.findMany({
    where: {
      schoolId: session.schoolId,
      role: Role.STUDENT,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      nis: true,
      cohortMemberships: {
        select: {
          cohort: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function bulkAddStudentsToCohort(cohortId: string, userIds: string[]) {
  await requireRole('ADMIN', 'TEACHER', 'SUPER_ADMIN');

  for (const userId of userIds) {
    await db.cohortMember.upsert({
      where: {
        cohortId_userId: {
          cohortId,
          userId,
        },
      },
      create: {
        cohortId,
        userId,
      },
      update: {},
    });
  }

  revalidatePath('/[locale]/admin/cohorts', 'page');
  return { success: true, count: userIds.length };
}

export async function bulkRemoveStudentsFromCohort(cohortId: string, userIds: string[]) {
  await requireRole('ADMIN', 'TEACHER', 'SUPER_ADMIN');

  const result = await db.cohortMember.deleteMany({
    where: {
      cohortId,
      userId: { in: userIds },
    },
  });

  revalidatePath('/[locale]/admin/cohorts', 'page');
  return result;
}

export async function promoteCohortStudents(data: {
  sourceCohortId: string;
  targetCohortId?: string;
  newTargetCohortName?: string;
  studentIds: string[];
  removeFromSourceCohort: boolean;
}) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('Sekolah tidak ditemukan');

  if (!data.studentIds || data.studentIds.length === 0) {
    throw new Error('Pilih minimal satu siswa untuk dipromosikan');
  }

  let finalTargetCohortId = data.targetCohortId;

  // If user requested to create a new cohort on the fly
  if (data.newTargetCohortName && data.newTargetCohortName.trim()) {
    const newCohort = await db.cohort.create({
      data: {
        name: data.newTargetCohortName.trim(),
        schoolId,
      },
    });
    finalTargetCohortId = newCohort.id;
  }

  if (!finalTargetCohortId) {
    throw new Error('Kohort tujuan harus dipilih atau dibuat');
  }

  if (finalTargetCohortId === data.sourceCohortId) {
    throw new Error('Kohort tujuan tidak boleh sama dengan kohort asal');
  }

  // Execute promotion in database transaction
  await db.$transaction(async (tx) => {
    // 1. Add students to target cohort
    for (const userId of data.studentIds) {
      await tx.cohortMember.upsert({
        where: {
          cohortId_userId: {
            cohortId: finalTargetCohortId!,
            userId,
          },
        },
        create: {
          cohortId: finalTargetCohortId!,
          userId,
        },
        update: {},
      });
    }

    // 2. Optionally remove from source cohort
    if (data.removeFromSourceCohort) {
      await tx.cohortMember.deleteMany({
        where: {
          cohortId: data.sourceCohortId,
          userId: { in: data.studentIds },
        },
      });
    }
  });

  revalidatePath('/[locale]/admin/cohorts', 'page');
  revalidatePath('/[locale]/admin/dashboard', 'page');

  return {
    success: true,
    promotedCount: data.studentIds.length,
    targetCohortId: finalTargetCohortId,
  };
}

export async function graduateCohortStudents(data: {
  cohortId: string;
  studentIds: string[];
  deactivateAccount?: boolean;
}) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('Sekolah tidak ditemukan');

  if (!data.studentIds || data.studentIds.length === 0) {
    throw new Error('Pilih minimal satu siswa yang akan diluluskan');
  }

  await db.$transaction(async (tx) => {
    // 1. Remove from cohort
    await tx.cohortMember.deleteMany({
      where: {
        cohortId: data.cohortId,
        userId: { in: data.studentIds },
      },
    });

    // 2. Optionally deactivate accounts (mark as alumni)
    if (data.deactivateAccount) {
      await tx.user.updateMany({
        where: {
          id: { in: data.studentIds },
          schoolId,
        },
        data: {
          isActive: false,
        },
      });
    }
  });

  revalidatePath('/[locale]/admin/cohorts', 'page');
  revalidatePath('/[locale]/admin/users', 'page');
  revalidatePath('/[locale]/admin/dashboard', 'page');

  return {
    success: true,
    graduatedCount: data.studentIds.length,
  };
}

export async function syncCohortToCourse(courseId: string, cohortId: string) {
  await requireRole('ADMIN', 'TEACHER', 'SUPER_ADMIN');

  // Get all members of the cohort
  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    include: {
      members: true,
    },
  });

  if (!cohort) throw new Error('Cohort not found');

  let enrolledCount = 0;
  for (const member of cohort.members) {
    await db.enrollment.upsert({
      where: {
        courseId_userId: {
          courseId,
          userId: member.userId,
        },
      },
      create: {
        courseId,
        userId: member.userId,
        cohortId,
        method: EnrollmentMethod.COHORT_SYNC,
      },
      update: {
        cohortId,
        method: EnrollmentMethod.COHORT_SYNC,
      },
    });
    enrolledCount++;
  }

  revalidatePath('/[locale]/teacher/course/[courseId]/enrollments', 'page');
  revalidatePath('/[locale]/admin/courses', 'page');
  return { success: true, enrolledCount };
}

export async function manualEnrollStudent(courseId: string, userId: string) {
  await requireRole('ADMIN', 'TEACHER', 'SUPER_ADMIN');

  const enrollment = await db.enrollment.upsert({
    where: {
      courseId_userId: {
        courseId,
        userId,
      },
    },
    create: {
      courseId,
      userId,
      method: EnrollmentMethod.MANUAL,
    },
    update: {},
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/enrollments', 'page');
  return enrollment;
}

export async function removeEnrollment(courseId: string, userId: string) {
  await requireRole('ADMIN', 'TEACHER', 'SUPER_ADMIN');

  const deleted = await db.enrollment.delete({
    where: {
      courseId_userId: {
        courseId,
        userId,
      },
    },
  });

  revalidatePath('/[locale]/teacher/course/[courseId]/enrollments', 'page');
  return deleted;
}

export interface ExcelPromotionRow {
  nis: string;
  name?: string;
  email?: string;
  newCohortName: string;
}

export async function batchPromoteExcel(data: {
  rows: ExcelPromotionRow[];
  sourceCohortIds?: string[];
  removeFromSourceCohort: boolean;
}) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('Sekolah tidak ditemukan');
  const targetSchoolId = schoolId as string;

  const validRows = data.rows.filter(
    (r) => r.nis && r.nis.trim() && r.newCohortName && r.newCohortName.trim()
  );
  if (validRows.length === 0) {
    throw new Error('Data Excel kosong atau tidak memiliki kolom NIS dan Kelas Baru');
  }

  const nisList = Array.from(new Set(validRows.map((r) => r.nis.trim())));

  // Ambil data user yang ada di database sekolah
  const existingUsers = await db.user.findMany({
    where: {
      schoolId,
      nis: { in: nisList },
    },
    select: {
      id: true,
      nis: true,
      email: true,
      name: true,
    },
  });

  const userByNis = new Map<string, (typeof existingUsers)[0]>();
  existingUsers.forEach((u) => {
    if (u.nis) userByNis.set(u.nis, u);
  });

  const transferOutRegex = /^(mutasi|pindah|keluar|keluar\s+sekolah|mutasi\s+keluar|dropout|drop\s+out)$/i;
  const retainedRegex = /^(tinggal|tetap|tidak\s+naik|tinggal\s+kelas)$/i;

  const transferOutUserIds: string[] = [];
  const retainedUserIds: string[] = [];
  const normalPromotions: { userId: string; newCohortName: string }[] = [];
  const transferInRows: ExcelPromotionRow[] = [];

  for (const row of validRows) {
    const nis = row.nis.trim();
    const target = row.newCohortName.trim();
    const existing = userByNis.get(nis);

    if (transferOutRegex.test(target)) {
      if (existing) {
        transferOutUserIds.push(existing.id);
      }
    } else if (retainedRegex.test(target)) {
      if (existing) {
        retainedUserIds.push(existing.id);
      }
    } else {
      if (existing) {
        normalPromotions.push({ userId: existing.id, newCohortName: target });
      } else {
        transferInRows.push(row);
      }
    }
  }

  let promotedCount = 0;
  let transferInCount = 0;

  await db.$transaction(async (tx) => {
    // 1. Siswa Mutasi Keluar
    if (transferOutUserIds.length > 0) {
      await tx.cohortMember.deleteMany({
        where: { userId: { in: transferOutUserIds } },
      });
      await tx.user.updateMany({
        where: { id: { in: transferOutUserIds }, schoolId },
        data: { isActive: false },
      });
    }

    const cohortNameToId = new Map<string, string>();
    async function getOrCreateCohortId(name: string): Promise<string> {
      const trimmed = name.trim();
      if (cohortNameToId.has(trimmed)) {
        return cohortNameToId.get(trimmed)!;
      }
      let c = await tx.cohort.findFirst({
        where: { schoolId: targetSchoolId, name: trimmed },
      });
      if (!c) {
        c = await tx.cohort.create({
          data: { name: trimmed, schoolId: targetSchoolId },
        });
      }
      cohortNameToId.set(trimmed, c.id);
      return c.id;
    }

    // 2. Siswa Mutasi Masuk (Siswa baru belum ada di DB)
    const defaultPasswordHash = hashPassword('123456');
    for (const inRow of transferInRows) {
      const nis = inRow.nis.trim();
      const targetCohortId = await getOrCreateCohortId(inRow.newCohortName);

      let studentEmail = inRow.email?.trim();
      if (!studentEmail) {
        studentEmail = `${nis}@student.${targetSchoolId.slice(0, 8).toLowerCase()}.local`;
      }

      const emailExists = await tx.user.findUnique({ where: { email: studentEmail } });
      if (emailExists) {
        studentEmail = `${nis}_${Date.now()}@student.local`;
      }

      const newUser = await tx.user.create({
        data: {
          name: inRow.name?.trim() || `Siswa Baru ${nis}`,
          email: studentEmail,
          nis,
          passwordHash: defaultPasswordHash,
          role: Role.STUDENT,
          isActive: true,
          mustChangePassword: true,
          schoolId: targetSchoolId,
        },
      });

      await tx.cohortMember.upsert({
        where: {
          cohortId_userId: {
            cohortId: targetCohortId,
            userId: newUser.id,
          },
        },
        create: {
          cohortId: targetCohortId,
          userId: newUser.id,
        },
        update: {},
      });

      transferInCount++;
    }

    // 3. Siswa Naik Kelas Normal
    const promotedUserIds: string[] = [];
    for (const item of normalPromotions) {
      const targetCohortId = await getOrCreateCohortId(item.newCohortName);
      await tx.cohortMember.upsert({
        where: {
          cohortId_userId: {
            cohortId: targetCohortId,
            userId: item.userId,
          },
        },
        create: {
          cohortId: targetCohortId,
          userId: item.userId,
        },
        update: {},
      });
      promotedUserIds.push(item.userId);
    }

    promotedCount = promotedUserIds.length;

    // 4. Hapus dari rombel lama sebelumnya jika diminta
    if (data.removeFromSourceCohort && promotedUserIds.length > 0) {
      if (data.sourceCohortIds && data.sourceCohortIds.length > 0) {
        await tx.cohortMember.deleteMany({
          where: {
            cohortId: { in: data.sourceCohortIds },
            userId: { in: promotedUserIds },
          },
        });
      } else {
        // Jika rombel asal tidak dispesifikkan secara manual, hapus keanggotaan selain rombel baru
        for (const item of normalPromotions) {
          const targetCohortId = cohortNameToId.get(item.newCohortName.trim());
          if (targetCohortId) {
            await tx.cohortMember.deleteMany({
              where: {
                userId: item.userId,
                cohortId: { not: targetCohortId },
              },
            });
          }
        }
      }
    }
  });

  revalidatePath('/[locale]/admin/cohorts', 'page');
  revalidatePath('/[locale]/admin/users', 'page');
  revalidatePath('/[locale]/admin/dashboard', 'page');

  return {
    success: true,
    promotedCount,
    transferOutCount: transferOutUserIds.length,
    transferInCount,
    retainedCount: retainedUserIds.length,
  };
}
