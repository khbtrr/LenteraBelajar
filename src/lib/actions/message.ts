'use server';

import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';

export interface ContactableUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  sharedCourses: string[];
}

/**
 * Check whether two users share at least one course (or if sender is Admin/Supervisor in the same school)
 */
export async function canMessageUser(
  currentUserId: string,
  targetUserId: string,
  currentUserRole: string,
  currentSchoolId: string | null
): Promise<boolean> {
  if (currentUserId === targetUserId) return false;

  // School Admins and Supervisors can message anyone in their school
  if (
    ['ADMIN', 'SUPERVISOR', 'SUPER_ADMIN'].includes(currentUserRole) &&
    currentSchoolId
  ) {
    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { schoolId: true, isActive: true },
    });
    if (targetUser?.isActive && (currentUserRole === 'SUPER_ADMIN' || targetUser.schoolId === currentSchoolId)) {
      return true;
    }
  }

  // Find all courses where currentUser is teacher or enrolled
  const user1Courses = await db.course.findMany({
    where: {
      OR: [
        { teacherId: currentUserId },
        { enrollments: { some: { userId: currentUserId } } },
      ],
    },
    select: { id: true },
  });

  const courseIds1 = user1Courses.map((c) => c.id);
  if (courseIds1.length === 0) return false;

  // Check if targetUser is enrolled in or teaches any of those courses
  const sharedCourse = await db.course.findFirst({
    where: {
      id: { in: courseIds1 },
      OR: [
        { teacherId: targetUserId },
        { enrollments: { some: { userId: targetUserId } } },
      ],
    },
    select: { id: true },
  });

  return !!sharedCourse;
}

/**
 * Search and retrieve users that current user can message (from shared courses)
 */
export async function getContactableUsers(search?: string): Promise<ContactableUser[]> {
  const session = await requireAuth();
  const currentUserId = session.user.id;
  const role = session.user.role;
  const schoolId = session.user.schoolId;

  const searchFilter = search?.trim()
    ? {
        OR: [
          { name: { contains: search.trim(), mode: 'insensitive' as const } },
          { email: { contains: search.trim(), mode: 'insensitive' as const } },
          { nis: { contains: search.trim(), mode: 'insensitive' as const } },
          { nip: { contains: search.trim(), mode: 'insensitive' as const } },
        ],
      }
    : {};

  if (['ADMIN', 'SUPERVISOR', 'SUPER_ADMIN'].includes(role) && schoolId) {
    // Admins and supervisors can contact all active users in their school
    const users = await db.user.findMany({
      where: {
        ...(role === 'SUPER_ADMIN' ? {} : { schoolId }),
        id: { not: currentUserId },
        isActive: true,
        ...searchFilter,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
      },
      take: 30,
      orderBy: { name: 'asc' },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      role: u.role,
      sharedCourses: ['Staf Sekolah / Rombel'],
    }));
  }

  // For TEACHER and STUDENT: find users in shared courses
  const myCourses = await db.course.findMany({
    where: {
      OR: [
        { teacherId: currentUserId },
        { enrollments: { some: { userId: currentUserId } } },
      ],
    },
    select: {
      id: true,
      title: true,
      teacherId: true,
      teacher: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          role: true,
          isActive: true,
          nis: true,
          nip: true,
        },
      },
      enrollments: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              role: true,
              isActive: true,
              nis: true,
              nip: true,
            },
          },
        },
      },
    },
  });

  const userMap = new Map<string, ContactableUser>();

  const matchesSearch = (u: { name: string; email: string; nis?: string | null; nip?: string | null }) => {
    if (!search?.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.nis && u.nis.toLowerCase().includes(q)) ||
      (u.nip && u.nip.toLowerCase().includes(q))
    );
  };

  for (const course of myCourses) {
    // Check teacher
    if (course.teacher && course.teacher.id !== currentUserId && course.teacher.isActive) {
      if (matchesSearch(course.teacher)) {
        const existing = userMap.get(course.teacher.id);
        if (existing) {
          if (!existing.sharedCourses.includes(course.title)) {
            existing.sharedCourses.push(course.title);
          }
        } else {
          userMap.set(course.teacher.id, {
            id: course.teacher.id,
            name: course.teacher.name,
            email: course.teacher.email,
            avatar: course.teacher.avatar,
            role: course.teacher.role,
            sharedCourses: [course.title],
          });
        }
      }
    }

    // Check enrolled students
    for (const enrollment of course.enrollments) {
      const u = enrollment.user;
      if (u && u.id !== currentUserId && u.isActive) {
        if (matchesSearch(u)) {
          const existing = userMap.get(u.id);
          if (existing) {
            if (!existing.sharedCourses.includes(course.title)) {
              existing.sharedCourses.push(course.title);
            }
          } else {
            userMap.set(u.id, {
              id: u.id,
              name: u.name,
              email: u.email,
              avatar: u.avatar,
              role: u.role,
              sharedCourses: [course.title],
            });
          }
        }
      }
    }
  }

  return Array.from(userMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 30);
}

/**
 * Get an existing 1-on-1 conversation or create a new one with target user
 */
export async function getOrCreateConversation(otherUserId: string): Promise<{
  conversationId: string;
  isNew: boolean;
}> {
  const session = await requireAuth();
  const currentUserId = session.user.id;

  if (currentUserId === otherUserId) {
    throw new Error('Tidak dapat membuat obrolan dengan diri sendiri');
  }

  // Validate permission
  const allowed = await canMessageUser(
    currentUserId,
    otherUserId,
    session.user.role,
    session.user.schoolId
  );
  if (!allowed) {
    throw new Error('Anda hanya dapat berkirim pesan dengan pengguna di kelas yang sama');
  }

  // Check existing 1-on-1 conversation
  const existingConv = await db.conversation.findFirst({
    where: {
      isGroup: false,
      AND: [
        { participants: { some: { userId: currentUserId } } },
        { participants: { some: { userId: otherUserId } } },
      ],
    },
    select: { id: true },
  });

  if (existingConv) {
    return { conversationId: existingConv.id, isNew: false };
  }

  // Create new conversation
  const newConv = await db.conversation.create({
    data: {
      isGroup: false,
      participants: {
        create: [
          { userId: currentUserId, lastReadAt: new Date() },
          { userId: otherUserId, lastReadAt: new Date(0) },
        ],
      },
    },
    select: { id: true },
  });

  revalidatePath('/messages');
  return { conversationId: newConv.id, isNew: true };
}

export interface ConversationSummary {
  id: string;
  isGroup: boolean;
  lastMessageAt: Date;
  otherUser: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    role: string;
  } | null;
  lastMessage: {
    id: string;
    content: string;
    isDeleted: boolean;
    senderId: string;
    createdAt: Date;
  } | null;
  unreadCount: number;
}

/**
 * Fetch conversations with accurate unread counts
 */
export async function getConversations(): Promise<ConversationSummary[]> {
  const session = await requireAuth();
  const currentUserId = session.user.id;

  const convs = await db.conversation.findMany({
    where: {
      participants: {
        some: { userId: currentUserId },
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              role: true,
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          content: true,
          isDeleted: true,
          senderId: true,
          createdAt: true,
        },
      },
    },
    orderBy: { lastMessageAt: 'desc' },
  });

  const result: ConversationSummary[] = [];

  for (const conv of convs) {
    const myPart = conv.participants.find((p) => p.userId === currentUserId);
    const otherPart = conv.participants.find((p) => p.userId !== currentUserId);
    const lastReadAt = myPart?.lastReadAt || new Date(0);

    const unreadCount = await db.directMessage.count({
      where: {
        conversationId: conv.id,
        createdAt: { gt: lastReadAt },
        senderId: { not: currentUserId },
      },
    });

    const lastMsg = conv.messages[0] || null;

    result.push({
      id: conv.id,
      isGroup: conv.isGroup,
      lastMessageAt: conv.lastMessageAt,
      otherUser: otherPart?.user || null,
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            content: lastMsg.isDeleted ? 'Pesan telah dihapus' : lastMsg.content,
            isDeleted: lastMsg.isDeleted,
            senderId: lastMsg.senderId,
            createdAt: lastMsg.createdAt,
          }
        : null,
      unreadCount,
    });
  }

  return result;
}

export interface FormattedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sender: {
    id: string;
    name: string;
    avatar: string | null;
    role: string;
  };
  content: string;
  isDeleted: boolean;
  createdAt: Date;
  isMine: boolean;
}

/**
 * Get messages in a conversation
 */
export async function getMessages(
  conversationId: string,
  limit = 50,
  before?: string
): Promise<{
  messages: FormattedMessage[];
  otherUser: {
    id: string;
    name: string;
    avatar: string | null;
    role: string;
    email: string;
  } | null;
  otherUserLastReadAt?: Date | null;
}> {
  const session = await requireAuth();
  const currentUserId = session.user.id;

  // Verify participant
  const conv = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
              role: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!conv) {
    throw new Error('Obrolan tidak ditemukan');
  }

  const isParticipant = conv.participants.some((p) => p.userId === currentUserId);
  const isAdminOrSupervisor = ['ADMIN', 'SUPERVISOR', 'SUPER_ADMIN'].includes(session.user.role);

  if (!isParticipant && !isAdminOrSupervisor) {
    throw new Error('Anda tidak memiliki akses ke percakapan ini');
  }

  const rawMessages = await db.directMessage.findMany({
    where: {
      conversationId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          avatar: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const otherParticipant = conv.participants.find((p) => p.userId !== currentUserId);

  const messages: FormattedMessage[] = rawMessages
    .reverse()
    .map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      sender: m.sender,
      content: m.isDeleted ? 'Pesan telah dihapus' : m.content,
      isDeleted: m.isDeleted,
      createdAt: m.createdAt,
      isMine: m.senderId === currentUserId,
    }));

  return {
    messages,
    otherUser: otherParticipant?.user || null,
    otherUserLastReadAt: otherParticipant?.lastReadAt || null,
  };
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(
  conversationId: string,
  content: string
): Promise<FormattedMessage> {
  const session = await requireAuth();
  const currentUserId = session.user.id;

  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Pesan tidak boleh kosong');
  }
  if (trimmed.length > 5000) {
    throw new Error('Pesan melebihi batas 5000 karakter');
  }

  // Verify participant
  const conv = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              schoolId: true,
            },
          },
        },
      },
    },
  });

  if (!conv) {
    throw new Error('Obrolan tidak ditemukan');
  }

  const myPart = conv.participants.find((p) => p.userId === currentUserId);
  if (!myPart) {
    throw new Error('Anda bukan anggota obrolan ini');
  }

  // Create message
  const now = new Date();
  const message = await db.directMessage.create({
    data: {
      conversationId,
      senderId: currentUserId,
      content: trimmed,
      createdAt: now,
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          avatar: true,
          role: true,
        },
      },
    },
  });

  // Update conversation lastMessageAt and my participant lastReadAt
  await Promise.all([
    db.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    }),
    db.conversationParticipant.update({
      where: { id: myPart.id },
      data: { lastReadAt: now },
    }),
  ]);

  // Notify other participant(s)
  const otherParticipants = conv.participants.filter((p) => p.userId !== currentUserId);
  for (const recipient of otherParticipants) {
    const preview = trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed;
    const link = `/messages?conversation=${conversationId}`;

    // Check if unread notification already exists for this conversation
    const existingNotif = await db.notification.findFirst({
      where: {
        userId: recipient.userId,
        type: 'MESSAGE',
        link,
        isRead: false,
      },
    });

    if (existingNotif) {
      await db.notification.update({
        where: { id: existingNotif.id },
        data: {
          title: `Pesan baru dari ${session.user.name}`,
          message: preview,
          createdAt: now,
        },
      });
    } else {
      await db.notification.create({
        data: {
          userId: recipient.userId,
          title: `Pesan baru dari ${session.user.name}`,
          message: preview,
          type: 'MESSAGE',
          link,
          createdAt: now,
        },
      });
    }
  }

  revalidatePath('/messages');

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    sender: message.sender,
    content: message.content,
    isDeleted: message.isDeleted,
    createdAt: message.createdAt,
    isMine: true,
  };
}

/**
 * Mark a conversation as read by the current user
 */
export async function markConversationAsRead(conversationId: string): Promise<void> {
  const session = await requireAuth();
  const currentUserId = session.user.id;

  const now = new Date();

  await db.conversationParticipant.updateMany({
    where: {
      conversationId,
      userId: currentUserId,
    },
    data: {
      lastReadAt: now,
    },
  });

  // Also mark message notifications for this conversation as read
  await db.notification.updateMany({
    where: {
      userId: currentUserId,
      type: 'MESSAGE',
      link: { contains: conversationId },
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });
}

/**
 * Soft delete a message (only by its sender)
 */
export async function deleteMessage(messageId: string): Promise<{ success: boolean }> {
  const session = await requireAuth();
  const currentUserId = session.user.id;

  const msg = await db.directMessage.findUnique({
    where: { id: messageId },
    select: { senderId: true, conversationId: true },
  });

  if (!msg) {
    throw new Error('Pesan tidak ditemukan');
  }

  if (msg.senderId !== currentUserId) {
    throw new Error('Hanya pengirim yang dapat menghapus pesan');
  }

  await db.directMessage.update({
    where: { id: messageId },
    data: { isDeleted: true },
  });

  revalidatePath('/messages');
  return { success: true };
}

/**
 * Count total unread messages across all user conversations
 */
export async function getUnreadMessageCount(): Promise<number> {
  const session = await requireAuth();
  const currentUserId = session.user.id;

  const myParticipants = await db.conversationParticipant.findMany({
    where: { userId: currentUserId },
    select: {
      conversationId: true,
      lastReadAt: true,
    },
  });

  if (myParticipants.length === 0) return 0;

  let total = 0;
  for (const part of myParticipants) {
    const unread = await db.directMessage.count({
      where: {
        conversationId: part.conversationId,
        createdAt: { gt: part.lastReadAt },
        senderId: { not: currentUserId },
      },
    });
    total += unread;
  }

  return total;
}

/**
 * Poll for new messages since a given ISO timestamp
 */
export async function pollNewMessages(
  conversationId: string,
  since: string
): Promise<FormattedMessage[]> {
  const session = await requireAuth();
  const currentUserId = session.user.id;

  const rawMessages = await db.directMessage.findMany({
    where: {
      conversationId,
      createdAt: { gt: new Date(since) },
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          avatar: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return rawMessages.map((m) => ({
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    sender: m.sender,
    content: m.isDeleted ? 'Pesan telah dihapus' : m.content,
    isDeleted: m.isDeleted,
    createdAt: m.createdAt,
    isMine: m.senderId === currentUserId,
  }));
}
