import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  accountActive: true, accountVersion: 0, tokenVersion: 0,
  accountRole: 'TEACHER', tokenRole: 'TEACHER', mustChangePassword: false,
}));
vi.mock('@/lib/auth', () => ({ auth: async () => ({ user: {
  id: 'caller', role: state.tokenRole, schoolId: 'school-a', locale: 'id', sessionVersion: state.tokenVersion,
} }) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock('@/lib/db', () => ({ db: {
  user: { findUnique: async () => ({ id: 'caller', role: state.accountRole, schoolId: 'school-a',
    isActive: state.accountActive, mustChangePassword: state.mustChangePassword,
    sessionVersion: state.accountVersion, assignedSchools: [] }) },
  school: { findUnique: async () => ({ id: 'school-a', isActive: true }) },
} }));
import { requireAuth } from '@/lib/auth-utils';

describe('authoritative server session', () => {
  beforeEach(() => {
    Object.assign(state, { accountActive: true, accountVersion: 0, tokenVersion: 0,
      accountRole: 'TEACHER', tokenRole: 'TEACHER', mustChangePassword: false });
  });
  it('rejects an account deactivated after login', async () => {
    state.accountActive = false;
    await expect(requireAuth()).rejects.toThrow(/login/);
  });
  it('rejects a session revoked by an account version change', async () => {
    state.accountVersion = 1;
    await expect(requireAuth()).rejects.toThrow(/login/);
  });
  it('uses the current role instead of the role captured at login', async () => {
    state.accountRole = 'STUDENT';
    expect((await requireAuth()).user.role).toBe('STUDENT');
  });
  it('requires a password change even if the JWT flag was cleared', async () => {
    state.mustChangePassword = true;
    await expect(requireAuth()).rejects.toThrow(/change-password/);
  });
});
