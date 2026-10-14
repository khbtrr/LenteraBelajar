import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getIndukSchool, SUI_SCHOOL_CODE } from '@/lib/school';
import { getSchoolBadgeLabel, getSchoolBadgeStyle } from '@/lib/school-utils';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    school: {
      findFirst: vi.fn(),
    },
  },
}));

describe('School Induk & Multi-Tenant Branding (SUI vs SRG)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves SUI (SMA Plus PGRI Cibinong) when present by code 20232396', async () => {
    const suiRecord = {
      id: 'cmtuujyjx0001e8luw56yhfe4',
      name: 'SMA Plus PGRI Cibinong',
      code: SUI_SCHOOL_CODE,
      logo: '/api/files/1789536206872_LOGO_PESAT.PNG',
      loginQuote: 'Pikiran bukanlah bejana yang harus diisi...',
      loginQuoteAuthor: 'Plutarch',
    };

    (db.school.findFirst as any).mockResolvedValueOnce(suiRecord);

    const school = await getIndukSchool();
    expect(db.school.findFirst).toHaveBeenCalledWith({
      where: {
        isActive: true,
        code: SUI_SCHOOL_CODE,
      },
      select: undefined,
    });
    expect(school).toEqual(suiRecord);
    expect(school?.name).toBe('SMA Plus PGRI Cibinong');
  });

  it('falls back to the earliest active school if code 20232396 is not matched', async () => {
    const fallbackSchool = {
      id: 'oldest-school-id',
      name: 'SMA Plus PGRI Cibinong',
      code: 'LEGACY_CODE',
      createdAt: new Date('2026-09-10'),
    };

    (db.school.findFirst as any).mockResolvedValueOnce(null);
    (db.school.findFirst as any).mockResolvedValueOnce(fallbackSchool);

    const school = await getIndukSchool({ name: true });
    expect(db.school.findFirst).toHaveBeenNthCalledWith(1, {
      where: { isActive: true, code: SUI_SCHOOL_CODE },
      select: { name: true },
    });
    expect(db.school.findFirst).toHaveBeenNthCalledWith(2, {
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { name: true },
    });
    expect(school).toEqual(fallbackSchool);
  });

  it('returns null if no active schools exist', async () => {
    (db.school.findFirst as any).mockResolvedValue(null);

    const school = await getIndukSchool();
    expect(school).toBeNull();
  });
});

describe('getSchoolBadgeLabel & getSchoolBadgeStyle (SUI vs SRG Tags)', () => {
  it('correctly maps SUI for SMA Plus PGRI Cibinong and code 20232396', () => {
    expect(getSchoolBadgeLabel({ code: '20232396', name: 'SMA Plus PGRI Cibinong' })).toBe('SUI');
    expect(getSchoolBadgeLabel({ code: '20232396' })).toBe('SUI');
    expect(getSchoolBadgeLabel({ name: 'SMA Plus PGRI Cibinong' })).toBe('SUI');
    expect(getSchoolBadgeStyle('SUI')).toContain('text-blue-700');
  });

  it('correctly maps SRG for SMA Plus PGRI Cibinong Reguler and code 70052833', () => {
    expect(getSchoolBadgeLabel({ code: '70052833', name: 'SMA Plus PGRI Cibinong Reguler' })).toBe('SRG');
    expect(getSchoolBadgeLabel({ code: '70052833' })).toBe('SRG');
    expect(getSchoolBadgeLabel({ code: 'REG-20232396', name: 'Reguler' })).toBe('SRG');
    expect(getSchoolBadgeLabel({ name: 'SMA Plus PGRI Cibinong Reguler' })).toBe('SRG');
    expect(getSchoolBadgeStyle('SRG')).toContain('text-amber-700');
  });

  it('handles null, undefined, or unknown schools gracefully', () => {
    expect(getSchoolBadgeLabel(null)).toBe('');
    expect(getSchoolBadgeLabel(undefined)).toBe('');
    expect(getSchoolBadgeLabel({ code: 'OTHER', name: 'Other School' })).toBe('OTHER');
    expect(getSchoolBadgeStyle('OTHER')).toContain('text-gray-700');
  });
});

