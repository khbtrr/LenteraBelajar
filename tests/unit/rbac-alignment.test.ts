import { describe, it, expect } from 'vitest';
import { Role, CalendarEventScope } from '@prisma/client';

describe('RBAC Alignment & Authorization Enforcement', () => {
  describe('Leger Nilai Access Rule', () => {
    function canAccessCohortLeger(role: Role, isHomeroomForCohort: boolean): boolean {
      if (!['ADMIN', 'SUPER_ADMIN', 'TEACHER'].includes(role)) {
        return false;
      }
      if (role === 'TEACHER' && !isHomeroomForCohort) {
        return false;
      }
      return true;
    }

    it('blocks STUDENT from accessing cohort leger data', () => {
      expect(canAccessCohortLeger(Role.STUDENT, false)).toBe(false);
      expect(canAccessCohortLeger(Role.STUDENT, true)).toBe(false);
    });

    it('blocks SUPERVISOR from viewing cohort student detail leger (per user decision)', () => {
      expect(canAccessCohortLeger(Role.SUPERVISOR, false)).toBe(false);
    });

    it('allows ADMIN and SUPER_ADMIN to access cohort leger for any class', () => {
      expect(canAccessCohortLeger(Role.ADMIN, false)).toBe(true);
      expect(canAccessCohortLeger(Role.SUPER_ADMIN, false)).toBe(true);
    });

    it('allows TEACHER only if they are the designated homeroom teacher', () => {
      expect(canAccessCohortLeger(Role.TEACHER, true)).toBe(true);
      expect(canAccessCohortLeger(Role.TEACHER, false)).toBe(false);
    });
  });

  describe('Monitoring Stats Access Rule', () => {
    function canAccessMonitoring(role: Role): boolean {
      return ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN'].includes(role);
    }

    it('blocks STUDENT and regular TEACHER from school activity monitoring', () => {
      expect(canAccessMonitoring(Role.STUDENT)).toBe(false);
      expect(canAccessMonitoring(Role.TEACHER)).toBe(false);
    });

    it('allows SUPERVISOR, ADMIN, and SUPER_ADMIN to view monitoring stats', () => {
      expect(canAccessMonitoring(Role.SUPERVISOR)).toBe(true);
      expect(canAccessMonitoring(Role.ADMIN)).toBe(true);
      expect(canAccessMonitoring(Role.SUPER_ADMIN)).toBe(true);
    });
  });

  describe('Privilege Escalation Prevention (Admin vs Super Admin)', () => {
    function validateUserRoleAssignment(
      actorRole: Role,
      targetRole: Role
    ): { allowed: boolean; error?: string } {
      if (actorRole !== Role.SUPER_ADMIN && targetRole === Role.SUPER_ADMIN) {
        return {
          allowed: false,
          error: 'Akses ditolak: Admin sekolah tidak dapat membuat akun dengan peran Super Admin.',
        };
      }
      return { allowed: true };
    }

    it('prevents School ADMIN from creating or promoting to SUPER_ADMIN', () => {
      const res = validateUserRoleAssignment(Role.ADMIN, Role.SUPER_ADMIN);
      expect(res.allowed).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('allows School ADMIN to create TEACHER, STUDENT, SUPERVISOR, or ADMIN', () => {
      expect(validateUserRoleAssignment(Role.ADMIN, Role.TEACHER).allowed).toBe(true);
      expect(validateUserRoleAssignment(Role.ADMIN, Role.STUDENT).allowed).toBe(true);
      expect(validateUserRoleAssignment(Role.ADMIN, Role.SUPERVISOR).allowed).toBe(true);
      expect(validateUserRoleAssignment(Role.ADMIN, Role.ADMIN).allowed).toBe(true);
    });

    it('allows SUPER_ADMIN to manage all roles including SUPER_ADMIN', () => {
      expect(validateUserRoleAssignment(Role.SUPER_ADMIN, Role.SUPER_ADMIN).allowed).toBe(true);
    });
  });

  describe('Course Creation Authorization', () => {
    function canCreateCourse(role: Role): boolean {
      return ['TEACHER', 'ADMIN', 'SUPER_ADMIN'].includes(role);
    }

    it('blocks STUDENT from directly creating courses', () => {
      expect(canCreateCourse(Role.STUDENT)).toBe(false);
    });

    it('allows TEACHER to create courses directly (per user decision)', () => {
      expect(canCreateCourse(Role.TEACHER)).toBe(true);
    });

    it('allows ADMIN and SUPER_ADMIN to create courses', () => {
      expect(canCreateCourse(Role.ADMIN)).toBe(true);
      expect(canCreateCourse(Role.SUPER_ADMIN)).toBe(true);
    });
  });

  describe('Cohort / Rombel Management Authorization', () => {
    function canManageCohort(role: Role): boolean {
      return ['ADMIN', 'SUPER_ADMIN'].includes(role);
    }

    it('restricts cohort creation and membership modification to ADMIN and SUPER_ADMIN', () => {
      expect(canManageCohort(Role.STUDENT)).toBe(false);
      expect(canManageCohort(Role.TEACHER)).toBe(false);
      expect(canManageCohort(Role.SUPERVISOR)).toBe(false);
      expect(canManageCohort(Role.ADMIN)).toBe(true);
      expect(canManageCohort(Role.SUPER_ADMIN)).toBe(true);
    });
  });

  describe('School Calendar & Announcement Authority', () => {
    function canCreateSchoolAnnouncement(role: Role): boolean {
      return ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR'].includes(role);
    }

    function canCreateSchoolCalendarEvent(scope: CalendarEventScope, role: Role): boolean {
      if (scope === CalendarEventScope.SCHOOL) {
        return ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR'].includes(role);
      }
      return true;
    }

    it('allows SUPERVISOR (Kepsek/Wakasek) to publish school announcements', () => {
      expect(canCreateSchoolAnnouncement(Role.SUPERVISOR)).toBe(true);
      expect(canCreateSchoolAnnouncement(Role.ADMIN)).toBe(true);
      expect(canCreateSchoolAnnouncement(Role.SUPER_ADMIN)).toBe(true);
      expect(canCreateSchoolAnnouncement(Role.TEACHER)).toBe(false);
      expect(canCreateSchoolAnnouncement(Role.STUDENT)).toBe(false);
    });

    it('allows SUPERVISOR (Kepsek/Wakasek) to create school-wide calendar events', () => {
      expect(canCreateSchoolCalendarEvent(CalendarEventScope.SCHOOL, Role.SUPERVISOR)).toBe(true);
      expect(canCreateSchoolCalendarEvent(CalendarEventScope.SCHOOL, Role.ADMIN)).toBe(true);
      expect(canCreateSchoolCalendarEvent(CalendarEventScope.SCHOOL, Role.TEACHER)).toBe(false);
      expect(canCreateSchoolCalendarEvent(CalendarEventScope.SCHOOL, Role.STUDENT)).toBe(false);
    });
  });
});
