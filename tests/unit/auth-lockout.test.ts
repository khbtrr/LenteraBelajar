import { describe, it, expect } from 'vitest';
import { Role } from '@prisma/client';

describe('Authentication Lockout & Multi-Tenant Unlock Logic', () => {
  describe('Account Lockout Duration & Status Computation', () => {
    function computeLockoutStatus(
      email: string,
      userRecord: {
        lockedUntil: Date | null;
        failedLoginAttempts: number;
      } | null,
      currentTime: Date = new Date()
    ) {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !userRecord) {
        return { isLocked: false, remainingMinutes: 0, failedAttempts: 0, maxAttempts: 5 };
      }

      const isLocked = Boolean(userRecord.lockedUntil && userRecord.lockedUntil > currentTime);
      const remainingMinutes = isLocked
        ? Math.max(1, Math.ceil((userRecord.lockedUntil!.getTime() - currentTime.getTime()) / (60 * 1000)))
        : 0;

      return {
        isLocked,
        remainingMinutes,
        failedAttempts: userRecord.failedLoginAttempts || 0,
        maxAttempts: 5,
      };
    }

    it('returns unlocked status when lockedUntil is null', () => {
      const status = computeLockoutStatus('siswa@sekolah.sch.id', {
        lockedUntil: null,
        failedLoginAttempts: 2,
      });

      expect(status.isLocked).toBe(false);
      expect(status.remainingMinutes).toBe(0);
      expect(status.failedAttempts).toBe(2);
    });

    it('returns locked status with rounded remaining minutes when lock is active in future', () => {
      const now = new Date('2026-10-09T10:00:00Z');
      const lockedUntil = new Date('2026-10-09T10:14:30Z'); // 14.5 minutes remaining

      const status = computeLockoutStatus(
        'siswa@sekolah.sch.id',
        { lockedUntil, failedLoginAttempts: 5 },
        now
      );

      expect(status.isLocked).toBe(true);
      expect(status.remainingMinutes).toBe(15);
      expect(status.failedAttempts).toBe(5);
    });

    it('treats past lockedUntil timestamps as unlocked', () => {
      const now = new Date('2026-10-09T10:30:00Z');
      const expiredLock = new Date('2026-10-09T10:15:00Z');

      const status = computeLockoutStatus(
        'siswa@sekolah.sch.id',
        { lockedUntil: expiredLock, failedLoginAttempts: 5 },
        now
      );

      expect(status.isLocked).toBe(false);
      expect(status.remainingMinutes).toBe(0);
    });

    it('normalizes uppercase and padded email addresses', () => {
      const now = new Date('2026-10-09T10:00:00Z');
      const status = computeLockoutStatus(
        '  SISWA@SEKOLAH.SCH.ID  ',
        { lockedUntil: null, failedLoginAttempts: 3 },
        now
      );

      expect(status.failedAttempts).toBe(3);
      expect(status.maxAttempts).toBe(5);
    });
  });

  describe('Unlock Authority & Tenant Isolation', () => {
    interface ActorSession {
      role: Role;
      schoolId: string | null;
    }

    interface TargetUser {
      id: string;
      schoolId: string;
    }

    function canUnlockAccount(actor: ActorSession, target: TargetUser): boolean {
      if (actor.role !== Role.ADMIN && actor.role !== Role.SUPER_ADMIN) {
        return false;
      }
      if (actor.role === Role.ADMIN && target.schoolId !== actor.schoolId) {
        return false;
      }
      return true;
    }

    it('allows SUPER_ADMIN to unlock users across different schools', () => {
      const superAdmin: ActorSession = { role: Role.SUPER_ADMIN, schoolId: null };
      const schoolAUser: TargetUser = { id: 'u1', schoolId: 'school-a' };
      const schoolBUser: TargetUser = { id: 'u2', schoolId: 'school-b' };

      expect(canUnlockAccount(superAdmin, schoolAUser)).toBe(true);
      expect(canUnlockAccount(superAdmin, schoolBUser)).toBe(true);
    });

    it('allows school ADMIN to unlock users within their own school', () => {
      const adminA: ActorSession = { role: Role.ADMIN, schoolId: 'school-a' };
      const userSameSchool: TargetUser = { id: 'u1', schoolId: 'school-a' };

      expect(canUnlockAccount(adminA, userSameSchool)).toBe(true);
    });

    it('blocks school ADMIN from unlocking users belonging to another school', () => {
      const adminA: ActorSession = { role: Role.ADMIN, schoolId: 'school-a' };
      const userDifferentSchool: TargetUser = { id: 'u2', schoolId: 'school-b' };

      expect(canUnlockAccount(adminA, userDifferentSchool)).toBe(false);
    });

    it('blocks TEACHER, SUPERVISOR, and STUDENT from unlocking accounts', () => {
      const target: TargetUser = { id: 'u1', schoolId: 'school-a' };
      const unauthorizedRoles = [Role.TEACHER, Role.SUPERVISOR, Role.STUDENT];

      for (const role of unauthorizedRoles) {
        expect(canUnlockAccount({ role, schoolId: 'school-a' }, target)).toBe(false);
      }
    });
  });
});
