import { describe, it, expect } from 'vitest';

describe('Multi-Tenant & RBAC Isolation Assertions (BUG-02 & BUG-03)', () => {
  interface UserSession {
    user: {
      id: string;
      role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN' | 'SUPERVISOR';
      schoolId: string | null;
    };
  }

  interface CourseResource {
    id: string;
    teacherId: string;
    schoolId: string;
  }

  function assertCourseAccess(session: UserSession, course: CourseResource) {
    if (session.user.role === 'SUPER_ADMIN') {
      return true;
    }

    if (session.user.role === 'ADMIN') {
      if (course.schoolId !== session.user.schoolId) {
        throw new Error('Akses ditolak: Kelas tidak berada dalam sekolah Anda');
      }
      return true;
    }

    if (session.user.role === 'TEACHER') {
      if (course.teacherId !== session.user.id) {
        throw new Error('Akses ditolak: Anda bukan pengajar untuk kelas ini');
      }
      return true;
    }

    throw new Error('Akses ditolak: Peran tidak diizinkan');
  }

  const schoolA = 'school-a-uuid';
  const schoolB = 'school-b-uuid';

  const teacherA: UserSession = {
    user: { id: 'teacher-a', role: 'TEACHER', schoolId: schoolA },
  };
  const teacherB: UserSession = {
    user: { id: 'teacher-b', role: 'TEACHER', schoolId: schoolB },
  };
  const adminA: UserSession = {
    user: { id: 'admin-a', role: 'ADMIN', schoolId: schoolA },
  };
  const adminB: UserSession = {
    user: { id: 'admin-b', role: 'ADMIN', schoolId: schoolB },
  };
  const superAdmin: UserSession = {
    user: { id: 'super-admin', role: 'SUPER_ADMIN', schoolId: null },
  };
  const studentA: UserSession = {
    user: { id: 'student-a', role: 'STUDENT', schoolId: schoolA },
  };

  const courseA: CourseResource = {
    id: 'course-1',
    teacherId: 'teacher-a',
    schoolId: schoolA,
  };

  describe('Course, Quiz & Proctoring Ownership', () => {
    it('allows teacher to manage their own course', () => {
      expect(() => assertCourseAccess(teacherA, courseA)).not.toThrow();
    });

    it('rejects another teacher from managing courseA', () => {
      expect(() => assertCourseAccess(teacherB, courseA)).toThrowError(
        'Akses ditolak: Anda bukan pengajar untuk kelas ini'
      );
    });

    it('allows Admin of School A to manage courseA', () => {
      expect(() => assertCourseAccess(adminA, courseA)).not.toThrow();
    });

    it('rejects Admin of School B from managing courseA across tenant boundaries', () => {
      expect(() => assertCourseAccess(adminB, courseA)).toThrowError(
        'Akses ditolak: Kelas tidak berada dalam sekolah Anda'
      );
    });

    it('allows Super Admin to manage courseA across all tenants', () => {
      expect(() => assertCourseAccess(superAdmin, courseA)).not.toThrow();
    });

    it('rejects students from performing teacher/admin actions', () => {
      expect(() => assertCourseAccess(studentA, courseA)).toThrowError(
        'Akses ditolak: Peran tidak diizinkan'
      );
    });
  });

  describe('Direct Messages Multi-Tenant Protection', () => {
    interface Conversation {
      id: string;
      participants: Array<{
        userId: string;
        user: { schoolId: string | null };
      }>;
    }

    function assertConversationAccess(session: UserSession, conversation: Conversation) {
      const isParticipant = conversation.participants.some(
        (p) => p.userId === session.user.id
      );
      const isSuperAdmin = session.user.role === 'SUPER_ADMIN';
      const isAdminOrSupervisor = ['ADMIN', 'SUPERVISOR'].includes(session.user.role);

      if (!isParticipant) {
        if (isSuperAdmin) {
          return true;
        } else if (isAdminOrSupervisor && session.user.schoolId) {
          const hasSchoolParticipant = conversation.participants.some(
            (p) => p.user.schoolId === session.user.schoolId
          );
          if (!hasSchoolParticipant) {
            throw new Error('Anda tidak memiliki akses ke percakapan ini');
          }
          return true;
        } else {
          throw new Error('Anda tidak memiliki akses ke percakapan ini');
        }
      }

      return true;
    }

    const conversationInSchoolA: Conversation = {
      id: 'conv-school-a',
      participants: [
        { userId: 'student-a', user: { schoolId: schoolA } },
        { userId: 'teacher-a', user: { schoolId: schoolA } },
      ],
    };

    it('allows conversation participants to access their conversation', () => {
      expect(() => assertConversationAccess(studentA, conversationInSchoolA)).not.toThrow();
      expect(() => assertConversationAccess(teacherA, conversationInSchoolA)).not.toThrow();
    });

    it('allows school admin to inspect conversations belonging to their school', () => {
      expect(() => assertConversationAccess(adminA, conversationInSchoolA)).not.toThrow();
    });

    it('blocks admin of another school from reading conversations of School A', () => {
      expect(() => assertConversationAccess(adminB, conversationInSchoolA)).toThrowError(
        'Anda tidak memiliki akses ke percakapan ini'
      );
    });

    it('blocks random non-participant teachers from other schools', () => {
      expect(() => assertConversationAccess(teacherB, conversationInSchoolA)).toThrowError(
        'Anda tidak memiliki akses ke percakapan ini'
      );
    });

    it('allows super admin to inspect conversations across any school', () => {
      expect(() => assertConversationAccess(superAdmin, conversationInSchoolA)).not.toThrow();
    });
  });
});
