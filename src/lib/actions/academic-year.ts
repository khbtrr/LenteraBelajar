'use server';

import { db } from '@/lib/db';
import { requireRole, requireSchool } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';

export async function getAcademicYears() {
  const session = await requireSchool();
  return db.academicYear.findMany({ where: { schoolId: session.schoolId }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { courses: true } } } });
}

async function archivePrevious(tx: Prisma.TransactionClient, schoolId: string, exceptId?: string) {
  const years = await tx.academicYear.findMany({ where: { schoolId, status: 'ACTIVE', ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
  await tx.course.updateMany({ where: { schoolId, academicYearId: { in: years.map((year) => year.id) } }, data: { status: 'ARCHIVED' } });
  await tx.academicYear.updateMany({ where: { id: { in: years.map((year) => year.id) } }, data: { status: 'ARCHIVED' } });
}

export async function createAcademicYear(data: { name: string; startDate: string; endDate: string; makeActive?: boolean }) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('Sekolah tidak ditemukan');
  const startDate = new Date(data.startDate), endDate = new Date(data.endDate);
  if (!data.name.trim() || !Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) throw new Error('Tanggal atau nama tahun ajaran tidak valid');
  const year = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id" = ${schoolId} FOR UPDATE`;
    if (data.makeActive) await archivePrevious(tx, schoolId);
    return tx.academicYear.create({ data: { name: data.name.trim(), startDate, endDate, schoolId, status: data.makeActive ? 'ACTIVE' : 'PLANNED' } });
  });
  revalidatePath('/[locale]/admin/academic-years', 'page');
  return year;
}

export async function setActiveAcademicYear(id: string) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('Sekolah tidak ditemukan');
  const year = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id" = ${schoolId} FOR UPDATE`;
    const target = await tx.academicYear.findUnique({ where: { id, schoolId } });
    if (!target) throw new Error('Tahun ajaran tidak ditemukan');
    await archivePrevious(tx, schoolId, id);
    return tx.academicYear.update({ where: { id, schoolId }, data: { status: 'ACTIVE' } });
  });
  revalidatePath('/[locale]/admin/academic-years', 'page');
  return year;
}

export async function archiveAcademicYear(id: string) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const schoolId = session.user.schoolId;
  if (!schoolId) throw new Error('Sekolah tidak ditemukan');
  const year = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id" = ${schoolId} FOR UPDATE`;
    const updated = await tx.academicYear.update({ where: { id, schoolId }, data: { status: 'ARCHIVED' } });
    await tx.course.updateMany({ where: { academicYearId: id, schoolId }, data: { status: 'ARCHIVED' } });
    return updated;
  });
  revalidatePath('/[locale]/admin/academic-years', 'page');
  return year;
}
