'use server';

import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-utils';

export interface AdminConversationItem {
  id: string;
  isGroup: boolean;
  createdAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  participants: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    role: string;
  }[];
  lastMessage: {
    id: string;
    content: string;
    isDeleted: boolean;
    senderName: string;
    createdAt: Date;
  } | null;
}

/**
 * Get all conversations in the admin/supervisor's school for moderation
 */
export async function getSchoolConversations(
  search?: string,
  page = 1,
  pageSize = 20
): Promise<{
  conversations: AdminConversationItem[];
  total: number;
  totalPages: number;
}> {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const role = session.user.role;
  const schoolId = session.user.schoolId;

  // Filter conversations where at least one participant belongs to school
  const schoolFilter =
    role === 'SUPER_ADMIN' || !schoolId
      ? {}
      : {
          participants: {
            some: {
              user: { schoolId },
            },
          },
        };

  // Search filter by participant name or email
  const searchFilter = search?.trim()
    ? {
        participants: {
          some: {
            user: {
              OR: [
                { name: { contains: search.trim(), mode: 'insensitive' as const } },
                { email: { contains: search.trim(), mode: 'insensitive' as const } },
              ],
            },
          },
        },
      }
    : {};

  const where = {
    ...schoolFilter,
    ...searchFilter,
  };

  const total = await db.conversation.count({ where });
  const totalPages = Math.ceil(total / pageSize);

  const rawConversations = await db.conversation.findMany({
    where,
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
        include: {
          sender: {
            select: {
              name: true,
            },
          },
        },
      },
      _count: {
        select: { messages: true },
      },
    },
    orderBy: { lastMessageAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const conversations: AdminConversationItem[] = rawConversations.map((conv) => {
    const lastMsg = conv.messages[0] || null;

    return {
      id: conv.id,
      isGroup: conv.isGroup,
      createdAt: conv.createdAt,
      lastMessageAt: conv.lastMessageAt,
      messageCount: conv._count.messages,
      participants: conv.participants.map((p) => p.user),
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            content: lastMsg.content,
            isDeleted: lastMsg.isDeleted,
            senderName: lastMsg.sender.name,
            createdAt: lastMsg.createdAt,
          }
        : null,
    };
  });

  return {
    conversations,
    total,
    totalPages,
  };
}

export interface AdminMessageDetail {
  id: string;
  conversationId: string;
  senderId: string;
  sender: {
    id: string;
    name: string;
    avatar: string | null;
    role: string;
    email: string;
  };
  content: string;
  isDeleted: boolean;
  createdAt: Date;
}

/**
 * Get full transcript of a conversation for moderation audit
 */
export async function getConversationMessagesAdmin(
  conversationId: string
): Promise<{
  conversation: {
    id: string;
    createdAt: Date;
    participants: {
      id: string;
      name: string;
      avatar: string | null;
      role: string;
      email: string;
    }[];
  };
  messages: AdminMessageDetail[];
}> {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const role = session.user.role;
  const schoolId = session.user.schoolId;

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

  // Check school access
  if (role !== 'SUPER_ADMIN' && schoolId) {
    const hasAccess = conv.participants.some((p) => p.user.schoolId === schoolId);
    if (!hasAccess) {
      throw new Error('Anda tidak memiliki akses ke sekolah ini');
    }
  }

  const rawMessages = await db.directMessage.findMany({
    where: { conversationId },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          avatar: true,
          role: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return {
    conversation: {
      id: conv.id,
      createdAt: conv.createdAt,
      participants: conv.participants.map((p) => p.user),
    },
    messages: rawMessages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      sender: m.sender,
      content: m.content,
      isDeleted: m.isDeleted,
      createdAt: m.createdAt,
    })),
  };
}
