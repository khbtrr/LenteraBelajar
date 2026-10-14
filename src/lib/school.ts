import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { SUI_SCHOOL_CODE } from '@/lib/school-utils';

export * from '@/lib/school-utils';

/**
 * Mengambil data sekolah induk (SUI - SMA Plus PGRI Cibinong).
 * Digunakan untuk:
 * 1. Branding halaman login bersama (pre-login state)
 * 2. Favicon & Metadata default pada root layout
 * 3. Fallback tenant context untuk SUPER_ADMIN jika belum memilih sekolah aktif
 */
export async function getIndukSchool<T extends Prisma.SchoolSelect>(select?: T) {
  // Prioritas 1: Cari sekolah induk SUI berdasarkan kode NPSN resmi (20232396)
  const sui = await db.school.findFirst({
    where: {
      isActive: true,
      code: SUI_SCHOOL_CODE,
    },
    select,
  });

  if (sui) {
    return sui as Prisma.SchoolGetPayload<{ select: T }>;
  }

  // Prioritas 2: Cari sekolah aktif tertua (sekolah induk awal)
  return (await db.school.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select,
  })) as Prisma.SchoolGetPayload<{ select: T }> | null;
}
