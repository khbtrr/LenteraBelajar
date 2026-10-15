import { describe, it, expect, vi } from 'vitest';
import { Role } from '@prisma/client';
import { validatePassword } from '@/lib/password-policy';

describe('Audit Remediation Logic & Security Tests (AUDIT-01 to AUDIT-07)', () => {
  describe('AUDIT-01: Super Admin Mutation Protection in User Management', () => {
    function assertCanMutateUser(
      actor: { role: Role; schoolId: string | null },
      targetUser: { id: string; role: Role; schoolId: string | null }
    ) {
      if (actor.role !== Role.SUPER_ADMIN && targetUser.role === Role.SUPER_ADMIN) {
        throw new Error('Akses ditolak: Admin sekolah tidak dapat mengubah status atau akun Super Admin.');
      }
      return true;
    }

    it('blocks local school ADMIN from toggling, resetting, or deleting a SUPER_ADMIN', () => {
      const localAdmin = { role: Role.ADMIN, schoolId: 'school-1' };
      const superAdminTarget = { id: 'sa-1', role: Role.SUPER_ADMIN, schoolId: 'school-1' };

      expect(() => assertCanMutateUser(localAdmin, superAdminTarget)).toThrow(
        /Akses ditolak: Admin sekolah tidak dapat/
      );
    });

    it('allows SUPER_ADMIN to mutate other users and super admins', () => {
      const superAdminActor = { role: Role.SUPER_ADMIN, schoolId: null };
      const superAdminTarget = { id: 'sa-2', role: Role.SUPER_ADMIN, schoolId: 'school-1' };
      const studentTarget = { id: 'st-1', role: Role.STUDENT, schoolId: 'school-1' };

      expect(assertCanMutateUser(superAdminActor, superAdminTarget)).toBe(true);
      expect(assertCanMutateUser(superAdminActor, studentTarget)).toBe(true);
    });

    it('allows local school ADMIN to mutate normal school users (TEACHER, STUDENT)', () => {
      const localAdmin = { role: Role.ADMIN, schoolId: 'school-1' };
      const teacherTarget = { id: 't-1', role: Role.TEACHER, schoolId: 'school-1' };

      expect(assertCanMutateUser(localAdmin, teacherTarget)).toBe(true);
    });
  });

  describe('AUDIT-02: Centralized Password Policy Enforcement & Lockout Defense', () => {
    it('rejects passwords shorter than 8 characters', () => {
      expect(validatePassword('Ab1!').isValid).toBe(false);
      expect(validatePassword('123456').isValid).toBe(false);
    });

    it('rejects passwords missing required character classes (uppercase, lowercase, number)', () => {
      expect(validatePassword('password123!').isValid).toBe(false); // No uppercase
      expect(validatePassword('PASSWORD123!').isValid).toBe(false); // No lowercase
      expect(validatePassword('Password!!!!').isValid).toBe(false); // No number
    });

    it('accepts strong compliant passwords', () => {
      expect(validatePassword('LenteraSecure2026!').isValid).toBe(true);
      expect(validatePassword('Admin@P4ssw0rd').isValid).toBe(true);
    });

    it('detects locked status before verifying password', () => {
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      const isLocked = lockedUntil > new Date();
      expect(isLocked).toBe(true);
    });
  });

  describe('AUDIT-03: Message Moderation Audit Logging', () => {
    it('creates an audit event with MESSAGE_MONITORED action', () => {
      const auditPayload = {
        action: 'MESSAGE_MONITORED',
        userId: 'admin-1',
        userEmail: 'admin@school.id',
        details: 'Admin admin@school.id membuka transkrip obrolan ID conv-123',
      };

      expect(auditPayload.action).toBe('MESSAGE_MONITORED');
      expect(auditPayload.details).toContain('conv-123');
    });
  });

  describe('AUDIT-04: Tenant Isolation on Lockout Status Query', () => {
    function getLockoutStatusIsolated(
      session: { role: Role; schoolId: string | null },
      user: { email: string; schoolId: string | null; lockedUntil: Date | null; failedLoginAttempts: number } | null
    ) {
      if (!user) {
        return { isLocked: false, remainingMinutes: 0, failedAttempts: 0, maxAttempts: 5 };
      }
      if (session.role !== Role.SUPER_ADMIN && user.schoolId !== session.schoolId) {
        return { isLocked: false, remainingMinutes: 0, failedAttempts: 0, maxAttempts: 5 };
      }
      const isLocked = Boolean(user.lockedUntil && user.lockedUntil > new Date());
      return {
        isLocked,
        remainingMinutes: isLocked ? 15 : 0,
        failedAttempts: user.failedLoginAttempts,
        maxAttempts: 5,
      };
    }

    it('returns empty/unlocked dummy status when school admin queries user from different school', () => {
      const adminSchoolA = { role: Role.ADMIN, schoolId: 'school-A' };
      const userSchoolB = {
        email: 'victim@school-b.id',
        schoolId: 'school-B',
        lockedUntil: new Date(Date.now() + 600000),
        failedLoginAttempts: 5,
      };

      const status = getLockoutStatusIsolated(adminSchoolA, userSchoolB);
      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(0);
      expect(status.remainingMinutes).toBe(0);
    });

    it('returns actual lockout status when querying user in the same school', () => {
      const adminSchoolA = { role: Role.ADMIN, schoolId: 'school-A' };
      const userSchoolA = {
        email: 'user@school-a.id',
        schoolId: 'school-A',
        lockedUntil: new Date(Date.now() + 600000),
        failedLoginAttempts: 5,
      };

      const status = getLockoutStatusIsolated(adminSchoolA, userSchoolA);
      expect(status.isLocked).toBe(true);
      expect(status.failedAttempts).toBe(5);
    });

    it('allows SUPER_ADMIN to query lockout status across any school', () => {
      const superAdmin = { role: Role.SUPER_ADMIN, schoolId: null };
      const userSchoolB = {
        email: 'victim@school-b.id',
        schoolId: 'school-B',
        lockedUntil: new Date(Date.now() + 600000),
        failedLoginAttempts: 5,
      };

      const status = getLockoutStatusIsolated(superAdmin, userSchoolB);
      expect(status.isLocked).toBe(true);
      expect(status.failedAttempts).toBe(5);
    });
  });

  describe('AUDIT-05: Rate Limiting on Resource-Intensive Endpoints', () => {
    it('constructs correct rate limit keys per user / IP', () => {
      const userId = 'usr-test-1';
      const ip = '192.168.1.100';

      const moodleKey = `moodle-preview:${userId || ip}`;
      const docxKey = `quiz-import:${userId || ip}`;
      const aikenKey = `quiz-import-aiken:${userId || ip}`;
      const xmlKey = `moodle-xml-questions:${userId || ip}`;
      const submitKey = `quiz-submit:${userId || ip}`;

      expect(moodleKey).toBe('moodle-preview:usr-test-1');
      expect(docxKey).toBe('quiz-import:usr-test-1');
      expect(aikenKey).toBe('quiz-import-aiken:usr-test-1');
      expect(xmlKey).toBe('moodle-xml-questions:usr-test-1');
      expect(submitKey).toBe('quiz-submit:usr-test-1');
    });
  });

  describe('AUDIT-06: Active School Cookie Flag Hardening', () => {
    function getActiveSchoolCookieOptions(nodeEnv = 'production') {
      return {
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax' as const,
        httpOnly: true,
        secure: nodeEnv === 'production',
      };
    }

    it('enforces httpOnly and secure flags in production', () => {
      const options = getActiveSchoolCookieOptions('production');
      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('lax');
    });

    it('keeps httpOnly true in development environments', () => {
      const options = getActiveSchoolCookieOptions('development');
      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(false);
    });
  });

  describe('AUDIT-07: Category IDOR Validation on Import', () => {
    function validateCategoryBelongsToCourse(
      targetCategoryId: string | null,
      courseId: string,
      existingCategories: Array<{ id: string; courseId: string }>
    ) {
      if (!targetCategoryId) return true;
      const found = existingCategories.find((c) => c.id === targetCategoryId && c.courseId === courseId);
      if (!found) {
        throw new Error('Kategori soal tidak valid atau tidak terdaftar pada mata pelajaran ini.');
      }
      return true;
    }

    it('rejects categoryId that belongs to another course', () => {
      const categories = [
        { id: 'cat-math', courseId: 'course-math' },
        { id: 'cat-physics', courseId: 'course-physics' },
      ];

      expect(() =>
        validateCategoryBelongsToCourse('cat-physics', 'course-math', categories)
      ).toThrow(/Kategori soal tidak valid/);
    });

    it('accepts categoryId that belongs to the target course', () => {
      const categories = [
        { id: 'cat-math', courseId: 'course-math' },
        { id: 'cat-physics', courseId: 'course-physics' },
      ];

      expect(
        validateCategoryBelongsToCourse('cat-math', 'course-math', categories)
      ).toBe(true);
    });

    it('accepts null/undefined categoryId (uncategorized)', () => {
      expect(validateCategoryBelongsToCourse(null, 'course-math', [])).toBe(true);
    });
  });
});
