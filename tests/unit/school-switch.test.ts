import { beforeEach, describe, expect, it, vi } from 'vitest';

const actor = vi.hoisted(() => ({
  id: 'user-super-1',
  role: 'SUPER_ADMIN',
  schoolId: null,
}));

vi.mock('@/lib/auth', () => ({
  auth: async () => ({
    user: {
      id: actor.id,
      role: actor.role,
      schoolId: actor.schoolId,
      sessionVersion: 0,
      email: 'superadmin@lentera.test',
    },
  }),
}));

vi.mock('@/lib/school', () => ({
  getIndukSchool: async () => ({ id: 'school-induk' }),
}));

const mockCookiesStore: Record<string, any> = {};
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (key: string) => (mockCookiesStore[key] ? { value: mockCookiesStore[key] } : undefined),
    set: (key: string, value: string) => {
      mockCookiesStore[key] = value;
    },
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

const revalidatedPaths: string[] = [];
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => {
    revalidatedPaths.push(path);
  },
}));

const mockSchools = [
  { id: 'school-induk', name: 'SMA Induk', code: '20232396', isActive: true },
  { id: 'sch-1', name: 'SMA Lentera Harapan', code: 'SMALH', isActive: true },
  { id: 'sch-2', name: 'SMA Plus PGRI Cibinong', code: 'PESAT', isActive: true },
];

vi.mock('@/lib/db', () => ({
  db: {
    school: {
      findMany: async () => mockSchools,
      findUnique: async ({ where }: any) => {
        return mockSchools.find((s) => s.id === where.id) || null;
      },
    },
    user: {
      findUnique: async () => ({
        id: actor.id,
        name: 'Super Admin',
        email: 'superadmin@lentera.test',
        role: actor.role,
        schoolId: actor.schoolId,
        isActive: true,
        mustChangePassword: false,
        sessionVersion: 0,
        locale: 'id',
        assignedSchools: [],
      }),
      update: async ({ where, data }: any) => {
        if (where.id === actor.id) {
          actor.schoolId = data.schoolId;
        }
        return { id: where.id, ...data };
      },
    },
    userSchool: {
      findUnique: async () => null,
    },
  },
}));

import { getUserSchools, switchActiveSchool } from '@/lib/actions/school';

describe('School Switching & Multi-Tenant Context for Super Admin', () => {
  beforeEach(() => {
    actor.id = 'user-super-1';
    actor.role = 'SUPER_ADMIN';
    Object.keys(mockCookiesStore).forEach((k) => delete mockCookiesStore[k]);
    revalidatedPaths.length = 0;
  });

  it('marks isSuperAdmin: true in getUserSchools response for SUPER_ADMIN role', async () => {
    const res = await getUserSchools();
    expect(res.isSuperAdmin).toBe(true);
    expect(res.schools).toHaveLength(3);
    expect(res.currentSchoolId).toBe('school-induk');
  });

  it('successfully switches active school and revalidates dashboard layouts', async () => {
    const res = await switchActiveSchool('sch-2');
    expect(res.success).toBe(true);
    expect(res.schoolId).toBe('sch-2');
    expect(actor.schoolId).toBe('sch-2');
    expect(mockCookiesStore['active_school_id']).toBe('sch-2');

    expect(revalidatedPaths).toContain('/[locale]/admin');
    expect(revalidatedPaths).toContain('/[locale]/admin/dashboard');
    expect(revalidatedPaths).toContain('/id/admin/dashboard');
    expect(revalidatedPaths).toContain('/en/admin/dashboard');
    expect(revalidatedPaths).toContain('/');
  });

  it('rejects switching to non-existent school ID', async () => {
    await expect(switchActiveSchool('sch-unknown')).rejects.toThrow('Sekolah tidak tersedia');
  });
});
