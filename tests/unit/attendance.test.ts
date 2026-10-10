import { describe, it, expect } from 'vitest';
import { AttendanceStatus, Role } from '@prisma/client';

describe('Attendance Session & Check-in Rules', () => {
  describe('Record Creation & Status Transitions', () => {
    interface AttendanceRecord {
      userId: string;
      status: AttendanceStatus;
      checkInAt: Date | null;
      notes?: string;
    }

    function createInitialRecords(enrolledUserIds: string[]): AttendanceRecord[] {
      return enrolledUserIds.map((userId) => ({
        userId,
        status: AttendanceStatus.ABSENT,
        checkInAt: null,
      }));
    }

    function updateRecordStatus(
      record: AttendanceRecord,
      newStatus: AttendanceStatus,
      timestamp: Date = new Date(),
      notes?: string
    ): AttendanceRecord {
      return {
        ...record,
        status: newStatus,
        checkInAt: newStatus === AttendanceStatus.PRESENT ? timestamp : null,
        notes: notes !== undefined ? notes : record.notes,
      };
    }

    it('initializes all enrolled students with ABSENT status by default', () => {
      const studentIds = ['student-1', 'student-2', 'student-3'];
      const records = createInitialRecords(studentIds);

      expect(records).toHaveLength(3);
      records.forEach((rec) => {
        expect(rec.status).toBe(AttendanceStatus.ABSENT);
        expect(rec.checkInAt).toBeNull();
      });
    });

    it('records checkInAt timestamp when student is marked PRESENT', () => {
      const record: AttendanceRecord = {
        userId: 'student-1',
        status: AttendanceStatus.ABSENT,
        checkInAt: null,
      };
      const checkInTime = new Date('2026-10-09T08:05:00Z');

      const updated = updateRecordStatus(record, AttendanceStatus.PRESENT, checkInTime);

      expect(updated.status).toBe(AttendanceStatus.PRESENT);
      expect(updated.checkInAt).toEqual(checkInTime);
    });

    it('clears checkInAt when status is updated to SICK or PERMISSION', () => {
      const presentRecord: AttendanceRecord = {
        userId: 'student-1',
        status: AttendanceStatus.PRESENT,
        checkInAt: new Date('2026-10-09T08:05:00Z'),
      };

      const updatedSick = updateRecordStatus(
        presentRecord,
        AttendanceStatus.SICK,
        new Date(),
        'Surat dokter terlampir'
      );

      expect(updatedSick.status).toBe(AttendanceStatus.SICK);
      expect(updatedSick.checkInAt).toBeNull();
      expect(updatedSick.notes).toBe('Surat dokter terlampir');
    });
  });

  describe('Self Check-in Validation & Token Matching', () => {
    interface SessionData {
      isOpen: boolean;
      allowSelfCheckin: boolean;
      startTime: Date | null;
      endTime: Date | null;
      token: string | null;
    }

    function validateSelfCheckin(
      session: SessionData,
      inputToken: string | null,
      currentTime: Date = new Date()
    ): { allowed: boolean; reason?: string } {
      if (!session.isOpen) {
        return { allowed: false, reason: 'Sesi presensi telah ditutup' };
      }

      if (!session.allowSelfCheckin) {
        return { allowed: false, reason: 'Presensi mandiri tidak diizinkan untuk sesi ini' };
      }

      if (session.startTime && currentTime < session.startTime) {
        return { allowed: false, reason: 'Sesi presensi belum dimulai' };
      }

      if (session.endTime && currentTime > session.endTime) {
        return { allowed: false, reason: 'Waktu presensi telah berakhir' };
      }

      if (session.token) {
        const cleanInput = (inputToken || '').trim().toUpperCase();
        const sessionToken = session.token.trim().toUpperCase();
        if (cleanInput !== sessionToken) {
          return { allowed: false, reason: 'Token presensi tidak sesuai' };
        }
      }

      return { allowed: true };
    }

    const baseSession: SessionData = {
      isOpen: true,
      allowSelfCheckin: true,
      startTime: new Date('2026-10-09T07:00:00Z'),
      endTime: new Date('2026-10-09T09:00:00Z'),
      token: 'HADIR2026',
    };

    it('permits check-in within valid time window and matching token', () => {
      const now = new Date('2026-10-09T07:30:00Z');
      const result = validateSelfCheckin(baseSession, '  hadir2026  ', now);

      expect(result.allowed).toBe(true);
    });

    it('rejects check-in when session is closed', () => {
      const closed = { ...baseSession, isOpen: false };
      const result = validateSelfCheckin(closed, 'HADIR2026');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Sesi presensi telah ditutup');
    });

    it('rejects check-in after endTime has elapsed', () => {
      const late = new Date('2026-10-09T09:15:00Z');
      const result = validateSelfCheckin(baseSession, 'HADIR2026', late);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Waktu presensi telah berakhir');
    });

    it('rejects check-in with incorrect token', () => {
      const now = new Date('2026-10-09T07:30:00Z');
      const result = validateSelfCheckin(baseSession, 'SALAH', now);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Token presensi tidak sesuai');
    });
  });

  describe('Attendance Authorization & Multi-Tenant Access', () => {
    interface SessionUser {
      id: string;
      role: Role;
      schoolId: string | null;
    }

    interface CourseTarget {
      teacherId: string;
      schoolId: string;
    }

    function canManageCourseAttendance(user: SessionUser, course: CourseTarget): boolean {
      if (user.role === Role.SUPER_ADMIN) return true;
      if (user.role === Role.ADMIN) return user.schoolId === course.schoolId;
      if (user.role === Role.TEACHER) return user.id === course.teacherId;
      return false;
    }

    it('authorizes assigned course teacher and blocks non-assigned teacher', () => {
      const course: CourseTarget = { teacherId: 'teacher-1', schoolId: 'school-a' };

      expect(
        canManageCourseAttendance({ id: 'teacher-1', role: Role.TEACHER, schoolId: 'school-a' }, course)
      ).toBe(true);

      expect(
        canManageCourseAttendance({ id: 'teacher-2', role: Role.TEACHER, schoolId: 'school-a' }, course)
      ).toBe(false);
    });

    it('authorizes school admin only for courses within their own school', () => {
      const courseSchoolA: CourseTarget = { teacherId: 'teacher-1', schoolId: 'school-a' };

      expect(
        canManageCourseAttendance({ id: 'admin-1', role: Role.ADMIN, schoolId: 'school-a' }, courseSchoolA)
      ).toBe(true);

      expect(
        canManageCourseAttendance({ id: 'admin-2', role: Role.ADMIN, schoolId: 'school-b' }, courseSchoolA)
      ).toBe(false);
    });

    it('blocks students from managing attendance sessions', () => {
      const course: CourseTarget = { teacherId: 'teacher-1', schoolId: 'school-a' };
      expect(
        canManageCourseAttendance({ id: 'student-1', role: Role.STUDENT, schoolId: 'school-a' }, course)
      ).toBe(false);
    });
  });
});
