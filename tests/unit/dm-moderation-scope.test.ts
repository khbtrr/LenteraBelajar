import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canStaffModerateConversation } from '@/lib/user-scope';

const sessionUser = vi.hoisted(() => ({
  id: 'admin-a',
  email: 'admin-a@lentera.test',
  role: 'ADMIN',
  schoolId: 'school-a',
}));

const auditLogs = vi.hoisted(() => [] as unknown[]);

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: async () => ({ user: sessionUser }),
  requireRole: async () => ({ user: sessionUser }),
}));

vi.mock('@/lib/audit-log', () => ({
  recordAuditLog: async (log: unknown) => {
    auditLogs.push(log);
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

const mockConversation = vi.hoisted(() => ({ value: null as null | Record<string, unknown> }));

vi.mock('@/lib/db', () => ({
  db: {
    conversation: {
      findUnique: async () => mockConversation.value,
    },
    directMessage: {
      findMany: async () => [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          senderId: 'student-a',
          sender: { id: 'student-a', name: 'Student A', avatar: null, role: 'STUDENT' },
          content: 'Halo guru',
          isDeleted: false,
          createdAt: new Date(),
        },
      ],
    },
  },
}));

import { pollNewMessages } from '@/lib/actions/message';
import { getConversationMessagesAdmin } from '@/lib/actions/message-admin';

describe('canStaffModerateConversation', () => {
  it('allows super admin to moderate any conversation', () => {
    const staff = { role: 'SUPER_ADMIN', schoolId: 'school-a' };
    const conv = {
      participants: [
        { user: { role: 'STUDENT', schoolId: 'school-b' } },
        { user: { role: 'TEACHER', schoolId: 'school-c' } },
      ],
    };
    expect(canStaffModerateConversation(staff, conv)).toBe(true);
  });

  it('allows school admin to moderate conversations where all members belong to their school', () => {
    const staff = { role: 'ADMIN', schoolId: 'school-a' };
    const conv = {
      participants: [
        { user: { role: 'STUDENT', schoolId: 'school-a' } },
        { user: { role: 'TEACHER', schoolId: 'school-a' } },
      ],
    };
    expect(canStaffModerateConversation(staff, conv)).toBe(true);
  });

  it('allows school admin to moderate student conversation with super admin', () => {
    const staff = { role: 'ADMIN', schoolId: 'school-a' };
    const conv = {
      participants: [
        { user: { role: 'STUDENT', schoolId: 'school-a' } },
        { user: { role: 'SUPER_ADMIN', schoolId: 'school-b' } },
      ],
    };
    expect(canStaffModerateConversation(staff, conv)).toBe(true);
  });

  it('blocks school admin from monitoring cross-school conversations', () => {
    const staff = { role: 'ADMIN', schoolId: 'school-a' };
    const conv = {
      participants: [
        { user: { role: 'STUDENT', schoolId: 'school-a' } },
        { user: { role: 'STUDENT', schoolId: 'school-b' } },
      ],
    };
    expect(canStaffModerateConversation(staff, conv)).toBe(false);
  });

  it('blocks school admin from monitoring conversations in another school', () => {
    const staff = { role: 'ADMIN', schoolId: 'school-a' };
    const conv = {
      participants: [
        { user: { role: 'STUDENT', schoolId: 'school-b' } },
        { user: { role: 'TEACHER', schoolId: 'school-b' } },
      ],
    };
    expect(canStaffModerateConversation(staff, conv)).toBe(false);
  });

  it('blocks school admin from monitoring super admin private conversations', () => {
    const staff = { role: 'ADMIN', schoolId: 'school-a' };
    const conv = {
      participants: [
        { user: { role: 'SUPER_ADMIN', schoolId: 'school-a' } },
        { user: { role: 'TEACHER', schoolId: 'school-b' } },
      ],
    };
    expect(canStaffModerateConversation(staff, conv)).toBe(false);
  });

  it('blocks teachers and students from moderating', () => {
    const teacher = { role: 'TEACHER', schoolId: 'school-a' };
    const conv = {
      participants: [
        { user: { role: 'STUDENT', schoolId: 'school-a' } },
        { user: { role: 'TEACHER', schoolId: 'school-a' } },
      ],
    };
    expect(canStaffModerateConversation(teacher, conv)).toBe(false);
  });
});

describe('DM polling and transcript audit logs', () => {
  beforeEach(() => {
    sessionUser.id = 'admin-a';
    sessionUser.role = 'ADMIN';
    sessionUser.schoolId = 'school-a';
    auditLogs.length = 0;
  });

  it('records audit log when staff polls non-participant messages', async () => {
    mockConversation.value = {
      id: 'conv-1',
      participants: [
        { userId: 'student-a', user: { role: 'STUDENT', schoolId: 'school-a' } },
        { userId: 'teacher-a', user: { role: 'TEACHER', schoolId: 'school-a' } },
      ],
    };

    const messages = await pollNewMessages('conv-1', new Date(0).toISOString());
    expect(messages).toHaveLength(1);
    expect(auditLogs).toHaveLength(1);
    expect((auditLogs[0] as { action: string }).action).toBe('MESSAGE_MONITORED');
  });

  it('does not record audit log when participant polls their own conversation', async () => {
    sessionUser.id = 'student-a';
    sessionUser.role = 'STUDENT';
    sessionUser.schoolId = 'school-a';

    mockConversation.value = {
      id: 'conv-1',
      participants: [
        { userId: 'student-a', user: { role: 'STUDENT', schoolId: 'school-a' } },
        { userId: 'teacher-a', user: { role: 'TEACHER', schoolId: 'school-a' } },
      ],
    };

    const messages = await pollNewMessages('conv-1', new Date(0).toISOString());
    expect(messages).toHaveLength(1);
    expect(auditLogs).toHaveLength(0);
  });

  it('denies staff from polling cross-school conversation and writes no messages', async () => {
    mockConversation.value = {
      id: 'conv-1',
      participants: [
        { userId: 'student-a', user: { role: 'STUDENT', schoolId: 'school-a' } },
        { userId: 'student-b', user: { role: 'STUDENT', schoolId: 'school-b' } },
      ],
    };

    await expect(pollNewMessages('conv-1', new Date(0).toISOString())).rejects.toThrow(/akses/);
    expect(auditLogs).toHaveLength(0);
  });

  it('denies staff from opening transcript of cross-school conversation', async () => {
    mockConversation.value = {
      id: 'conv-1',
      createdAt: new Date(),
      participants: [
        { userId: 'student-a', user: { id: 'student-a', name: 'A', avatar: null, role: 'STUDENT', email: 'a@test', schoolId: 'school-a' } },
        { userId: 'student-b', user: { id: 'student-b', name: 'B', avatar: null, role: 'STUDENT', email: 'b@test', schoolId: 'school-b' } },
      ],
    };

    await expect(getConversationMessagesAdmin('conv-1')).rejects.toThrow(/akses/);
    expect(auditLogs).toHaveLength(0);
  });
});
