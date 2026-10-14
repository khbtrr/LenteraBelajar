/**
 * Utility dan konstanta penamaan institusi/sekolah.
 * Bebas dari ketergantungan server/database sehingga aman digunakan
 * baik di Client Components ('use client') maupun Server Components.
 */

/** NPSN resmi SUI (SMA Plus PGRI Cibinong - Unggulan-Internasional) */
export const SUI_SCHOOL_CODE = '20232396';

/** NPSN resmi SRG (SMA Plus PGRI Cibinong Reguler - Reguler) */
export const SRG_SCHOOL_CODE = '70052833';

export interface SchoolIdentifier {
  code?: string | null;
  name?: string | null;
}

/**
 * Mengembalikan label singkatan resmi untuk sekolah:
 * - SMA Plus PGRI Cibinong (Unggulan-Internasional) -> 'SUI'
 * - SMA Plus PGRI Cibinong Reguler (Reguler) -> 'SRG'
 */
export function getSchoolBadgeLabel(school?: SchoolIdentifier | null): string {
  if (!school) return '';
  const code = (school.code || '').trim().toUpperCase();
  const name = (school.name || '').trim().toLowerCase();

  // SRG: Reguler (Kode NPSN 70052833 atau nama mengandung 'reguler')
  if (
    code === SRG_SCHOOL_CODE ||
    code === 'SRG' ||
    code.startsWith('REG') ||
    code.includes('REG') ||
    name.includes('reguler') ||
    name.includes('srg')
  ) {
    return 'SRG';
  }

  // SUI: Unggulan-Internasional (Kode NPSN 20232396 atau SMA Plus PGRI Cibinong)
  if (
    code === SUI_SCHOOL_CODE ||
    code === 'SUI' ||
    name.includes('cibinong') ||
    name.includes('unggulan') ||
    name.includes('internasional') ||
    name.includes('sui')
  ) {
    return 'SUI';
  }

  return school.code || school.name || '';
}

/**
 * Mengembalikan class Tailwind badge berdasarkan jenis sekolah:
 * - SUI: Nuansa Deep Navy / Blue (SUI)
 * - SRG: Nuansa Amber / Warm (SRG)
 */
export function getSchoolBadgeStyle(
  schoolOrLabel?: SchoolIdentifier | string | null
): string {
  const label =
    typeof schoolOrLabel === 'string'
      ? schoolOrLabel
      : getSchoolBadgeLabel(schoolOrLabel);

  if (label === 'SRG') {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900';
  }

  if (label === 'SUI') {
    return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900';
  }

  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
}
