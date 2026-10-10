'use server';

import { db } from '@/lib/db';
import { requireSchool, requireRole, hashPassword } from '@/lib/auth-utils';
import { generateDefaultPassword } from '@/lib/password-policy';
import { EnrollmentMethod, Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { assertCourseAccess, assertSchoolResource, assertSchoolStudent, assertAcademicReferences } from '@/lib/access';

export async function getCohorts(options?: { activeOnly?: boolean; allSchools?: boolean }) {
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN', 'SUPERVISOR');
  const session = await requireSchool();
  const allowAllSchools = Boolean(options?.allSchools && session.user.role === 'SUPER_ADMIN');
  return db.cohort.findMany({
    where: {
      ...(allowAllSchools ? {} : { schoolId: session.schoolId }),
      ...(options?.activeOnly ? { isActive: true } : {}),
    },
    include: {
      school: {
        select: { id: true, name: true, code: true },
      },
      homeroomTeacher: {
        select: { id: true, name: true, email: true },
      },
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
  await requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN', 'SUPERVISOR');
  const session = await requireSchool();
  return db.cohort.findUnique({
    where: { id, schoolId: session.schoolId },
    include: {
      homeroomTeacher: {
        select: { id: true, name: true, email: true },
      },
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

export async function getAvailableTeachersForCohort() {
  const session = await requireSchool();
  const schoolId = session.schoolId;

  return db.user.findMany({
    where: {
      role: 'TEACHER',
      OR: [
        { schoolId },
        { assignedSchools: { some: { schoolId } } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      homeroomCohorts: {
        where: { schoolId, isActive: true },
        select: { id: true, name: true },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function createCohort(name: string, homeroomTeacherId?: string | null) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');
  await assertAcademicReferences(schoolId, { teacherId: homeroomTeacherId });

  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Cohort name cannot be empty');

  // Check unique name in same school
  const existing = await db.cohort.findFirst({
    where: { schoolId, name: { equals: trimmedName, mode: 'insensitive' } },
  });
  if (existing) {
    throw new Error('DUPLICATE_NAME');
  }

  // Check 1-to-1 homeroom teacher constraint
  if (homeroomTeacherId) {
    const existingHomeroom = await db.cohort.findFirst({
      where: {
        schoolId,
        homeroomTeacherId,
        isActive: true,
      },
      select: { name: true },
    });
    if (existingHomeroom) {
      throw new Error(`Guru tersebut sudah ditugaskan sebagai wali kelas di rombel ${existingHomeroom.name}`);
    }
  }

  const cohort = await db.cohort.create({
    data: {
      name: trimmedName,
      schoolId,
      homeroomTeacherId: homeroomTeacherId || null,
      isActive: true,
    },
  });

  revalidatePath('/[locale]/admin/cohorts', 'page');
  return cohort;
}

export async function updateCohort(id: string, name: string, homeroomTeacherId?: string | null) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');
  await assertAcademicReferences(schoolId, { teacherId: homeroomTeacherId });

  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Cohort name cannot be empty');

  const cohort = await db.cohort.findUnique({
    where: { id, schoolId },
  });
  if (!cohort) {
    throw new Error('Cohort not found');
  }

  // Check if another cohort with the same name already exists in this school
  const existingWithSameName = await db.cohort.findFirst({
    where: {
      schoolId,
      name: { equals: trimmedName, mode: 'insensitive' },
      id: { not: id },
    },
  });
  if (existingWithSameName) {
    throw new Error('DUPLICATE_NAME');
  }

  // Check 1-to-1 homeroom teacher constraint
  if (homeroomTeacherId) {
    const existingHomeroom = await db.cohort.findFirst({
      where: {
        schoolId,
        homeroomTeacherId,
        id: { not: id },
        isActive: true,
      },
      select: { name: true },
    });
    if (existingHomeroom) {
      throw new Error(`Guru tersebut sudah ditugaskan sebagai wali kelas di rombel ${existingHomeroom.name}`);
    }
  }

  const updated = await db.cohort.update({
    where: { id },
    data: {
      name: trimmedName,
      ...(homeroomTeacherId !== undefined ? { homeroomTeacherId: homeroomTeacherId || null } : {}),
    },
  });

  revalidatePath('/[locale]/admin/cohorts', 'page');
  return updated;
}

export async function toggleCohortActive(id: string, isActive?: boolean) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  const cohort = await db.cohort.findUnique({
    where: { id, schoolId },
    select: { id: true, isActive: true },
  });
  if (!cohort) {
    throw new Error('Cohort not found');
  }

  const newStatus = typeof isActive === 'boolean' ? isActive : !cohort.isActive;

  const updated = await db.cohort.update({
    where: { id },
    data: { isActive: newStatus },
  });

  revalidatePath('/[locale]/admin/cohorts', 'page');
  return updated;
}

export async function deleteCohort(id: string) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  const cohort = await db.cohort.findUnique({
    where: { id, schoolId },
  });
  if (!cohort) {
    throw new Error('Cohort not found');
  }

  await db.$transaction([
    db.enrollment.updateMany({
      where: { cohortId: id },
      data: { cohortId: null },
    }),
    db.cohortMember.deleteMany({
      where: { cohortId: id },
    }),
    db.cohort.delete({
      where: { id },
    }),
  ]);

  revalidatePath('/[locale]/admin/cohorts', 'page');
  return { success: true, id };
}

export interface BulkCreateCohortResult {
  createdCount: number;
  skippedCount: number;
  createdNames: string[];
  skippedNames: string[];
}

export async function bulkCreateCohorts(cohortNames: string[]): Promise<BulkCreateCohortResult> {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('No school selected');

  // Clean and filter empty / unique names from input
  const cleanedNames = Array.from(
    new Set(
      cohortNames
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
    )
  );

  if (cleanedNames.length === 0) {
    return { createdCount: 0, skippedCount: 0, createdNames: [], skippedNames: [] };
  }

  // Find existing cohorts in the school
  const existingCohorts = await db.cohort.findMany({
    where: { schoolId },
    select: { name: true },
  });
  const existingNameSet = new Set(existingCohorts.map((c) => c.name.trim().toLowerCase()));

  const toCreate: string[] = [];
  const skipped: string[] = [];

  for (const name of cleanedNames) {
    if (existingNameSet.has(name.toLowerCase())) {
      skipped.push(name);
    } else {
      toCreate.push(name);
      existingNameSet.add(name.toLowerCase()); // prevent duplicate within the same batch
    }
  }

  if (toCreate.length > 0) {
    await db.cohort.createMany({
      data: toCreate.map((name) => ({
        name,
        schoolId,
        isActive: true,
      })),
    });
  }

  revalidatePath('/[locale]/admin/cohorts', 'page');

  return {
    createdCount: toCreate.length,
    skippedCount: skipped.length,
    createdNames: toCreate,
    skippedNames: skipped,
  };
}

export async function addStudentToCohort(cohortId: string, userId: string) {
  const { resource } = await assertSchoolResource('cohort', cohortId);
  await assertSchoolStudent(userId, resource.schoolId);

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
  await assertSchoolResource('cohort', cohortId);

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

export async function getStudentsInSchool(options?: { allSchools?: boolean }) {
  await requireRole('ADMIN', 'TEACHER', 'SUPER_ADMIN');
  const session = await requireSchool();
  return db.user.findMany({
    where: {
      ...(options?.allSchools && session.user.role === 'SUPER_ADMIN' ? {} : { schoolId: session.schoolId }),
      role: Role.STUDENT,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      nis: true,
      schoolId: true,
      school: {
        select: { id: true, name: true, code: true },
      },
      cohortMemberships: {
        select: {
          cohort: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getEnrollmentCandidates(courseId: string) {
  const { course } = await assertCourseAccess(courseId, 'manage');
  const schoolFilter = course.isCrossSchool ? {} : { schoolId: course.schoolId };
  const [cohorts, students] = await Promise.all([
    db.cohort.findMany({ where: { ...schoolFilter, isActive: true }, select: { id: true, name: true, school: { select: { id: true, name: true, code: true } }, _count: { select: { members: true } } }, orderBy: { name: 'asc' } }),
    db.user.findMany({ where: { ...schoolFilter, role: 'STUDENT', isActive: true }, select: { id: true, name: true, email: true, nis: true, school: { select: { id: true, name: true, code: true } } }, orderBy: { name: 'asc' } }),
  ]);
  return { cohorts, students };
}

export async function bulkAddStudentsToCohort(cohortId: string, userIds: string[]) {
  const { resource } = await assertSchoolResource('cohort', cohortId);
  for (const userId of userIds) await assertSchoolStudent(userId, resource.schoolId);

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
  await assertSchoolResource('cohort', cohortId);

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
  const { resource: source } = await assertSchoolResource('cohort', data.sourceCohortId);
  if (source.schoolId !== schoolId) throw new Error('Akses ditolak: Rombel bukan sekolah aktif');
  if (data.targetCohortId) {
    const { resource: target } = await assertSchoolResource('cohort', data.targetCohortId);
    if (target.schoolId !== source.schoolId) throw new Error('Akses ditolak: Sekolah rombel berbeda');
  }
  const sourceCount = await db.cohortMember.count({ where: { cohortId: data.sourceCohortId, userId: { in: [...new Set(data.studentIds)] } } });
  if (sourceCount !== new Set(data.studentIds).size) throw new Error('Akses ditolak: Siswa bukan anggota rombel asal');
  for (const userId of data.studentIds) await assertSchoolStudent(userId, source.schoolId);

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
  const { resource } = await assertSchoolResource('cohort', data.cohortId);
  if (resource.schoolId !== schoolId) throw new Error('Akses ditolak: Rombel bukan sekolah aktif');
  const memberCount = await db.cohortMember.count({ where: { cohortId: data.cohortId, userId: { in: [...new Set(data.studentIds)] } } });
  if (memberCount !== new Set(data.studentIds).size) throw new Error('Akses ditolak: Siswa bukan anggota rombel');
  for (const userId of data.studentIds) await assertSchoolStudent(userId, resource.schoolId);

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
          sessionVersion: { increment: 1 },
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
  const { course } = await assertCourseAccess(courseId, 'manage');

  // Get all members of the cohort
  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    include: {
      members: true,
    },
  });

  if (!cohort) throw new Error('Cohort not found');
  if (!course.isCrossSchool && cohort.schoolId !== course.schoolId) throw new Error('Akses ditolak: Sekolah rombel berbeda');
  for (const member of cohort.members) await assertSchoolStudent(member.userId, course.schoolId, course.isCrossSchool);

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
  const { course } = await assertCourseAccess(courseId, 'manage');
  await assertSchoolStudent(userId, course.schoolId, course.isCrossSchool);

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
  await assertCourseAccess(courseId, 'manage');

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
  for (const id of data.sourceCohortIds ?? []) await assertSchoolResource('cohort', id);

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
        where: { userId: { in: transferOutUserIds }, cohort: { schoolId } },
      });
      await tx.user.updateMany({
        where: { id: { in: transferOutUserIds }, schoolId },
        data: { isActive: false, sessionVersion: { increment: 1 } },
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
    const defaultPasswordHash = hashPassword(generateDefaultPassword());
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
                cohort: { schoolId },
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
