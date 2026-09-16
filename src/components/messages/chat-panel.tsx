'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import {
  FormattedMessage,
  getMessages,
  sendMessage,
  deleteMessage,
  markConversationAsRead,
  pollNewMessages,
} from '@/lib/actions/message';
import { MessageBubble } from './message-bubble';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Send,
  Loader2,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';

interface ChatPanelProps {
  conversationId: string;
  onBack?: () => void;
  onMessageSent?: () => void;
}

export function ChatPanel({
  conversationId,
  onBack,
  onMessageSent,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<FormattedMessage[]>([]);
  const [otherUser, setOtherUser] = useState<{
    id: string;
    name: string;
    avatar: string | null;
    role: string;
    email: string;
  } | null>(null);
  const [otherUserLastReadAt, setOtherUserLastReadAt] = useState<Date | null>(null);
  const [inputContent, setInputContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageTimestampRef = useRef<string | null>(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  // Initial fetch of messages
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    async function loadChat() {
      try {
        const data = await getMessages(conversationId);
        if (!isMounted) return;

        setMessages(data.messages);
        setOtherUser(data.otherUser);
        setOtherUserLastReadAt(data.otherUserLastReadAt ? new Date(data.otherUserLastReadAt) : null);

        if (data.messages.length > 0) {
          const lastMsg = data.messages[data.messages.length - 1];
          lastMessageTimestampRef.current = new Date(lastMsg.createdAt).toISOString();
        } else {
          lastMessageTimestampRef.current = new Date().toISOString();
        }

        // Mark as read immediately
        await markConversationAsRead(conversationId);
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Gagal memuat pesan');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setTimeout(() => scrollToBottom(false), 50);
        }
      }
    }

    loadChat();

    return () => {
      isMounted = false;
    };
  }, [conversationId]);

  // Polling for new messages every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!lastMessageTimestampRef.current || isLoading) return;

      try {
        const newMsgs = await pollNewMessages(
          conversationId,
          lastMessageTimestampRef.current
        );

        if (newMsgs.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const fresh = newMsgs.filter((m) => !existingIds.has(m.id));
            if (fresh.length === 0) return prev;

            const updated = [...prev, ...fresh];
            const last = updated[updated.length - 1];
            lastMessageTimestampRef.current = new Date(last.createdAt).toISOString();
            return updated;
          });

          // Mark incoming as read
          await markConversationAsRead(conversationId);
          setTimeout(() => scrollToBottom(true), 50);
        }
      } catch (err) {
        // Silently ignore polling error to avoid disrupting UX
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [conversationId, isLoading]);

  const handleSend = async () => {
    const text = inputContent.trim();
    if (!text || isSending) return;

    try {
      setIsSending(true);
      setError(null);

      const createdMsg = await sendMessage(conversationId, text);
      setInputContent('');

      setMessages((prev) => [...prev, createdMsg]);
      lastMessageTimestampRef.current = new Date(createdMsg.createdAt).toISOString();

      setTimeout(() => scrollToBottom(true), 50);
      onMessageSent?.();
    } catch (err: any) {
      setError(err?.message || 'Gagal mengirim pesan');
    } finally {
      setIsSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    await deleteMessage(messageId);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, isDeleted: true, content: 'Pesan telah dihapus' }
          : m
      )
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'TEACHER':
        return 'Guru';
      case 'STUDENT':
        return 'Siswa';
      case 'ADMIN':
        return 'Admin';
      case 'SUPERVISOR':
        return 'Pengawas';
      case 'SUPER_ADMIN':
        return 'Super Admin';
      default:
        return '';
    }
  };

  const formatMessageDate = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();

    if (isToday) return 'Hari ini';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return 'Kemarin';

    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 p-6">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-2" />
        <span className="text-xs text-gray-400">Memuat percakapan...</span>
      </div>
    );
  }

  if (error && messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-10 h-10 text-red-500 mb-2" />
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{error}</p>
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack} className="mt-4 text-xs">
            Kembali ke Daftar Pesan
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/40 dark:bg-gray-950/40">
      {/* Top Header */}
      <div className="px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <Avatar className="w-10 h-10 border border-gray-100 dark:border-gray-800">
            {otherUser?.avatar ? (
              <AvatarImage src={otherUser.avatar} alt={otherUser.name} />
            ) : (
              <AvatarFallback className="bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300 text-xs font-semibold">
                {otherUser ? getInitials(otherUser.name) : '?'}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {otherUser?.name || 'Obrolan'}
              </h3>
              {otherUser?.role && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                  {getRoleLabel(otherUser.role)}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-gray-400 truncate">
              {otherUser?.email || ''}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
            <div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-brand-950/50 text-brand-500 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Mulai Percakapan
            </p>
            <p className="text-xs text-gray-400 max-w-xs mt-1">
              Kirim pesan pertama Anda kepada {otherUser?.name || 'rekan Anda'}.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            // Group by day date separator
            const currentDate = new Date(msg.createdAt).toDateString();
            const prevDate =
              index > 0 ? new Date(messages[index - 1].createdAt).toDateString() : null;
            const showDateSeparator = currentDate !== prevDate;

            // Check if read by other user
            const isRead = Boolean(
              otherUserLastReadAt &&
              new Date(msg.createdAt) <= new Date(otherUserLastReadAt)
            );

            return (
              <React.Fragment key={msg.id}>
                {showDateSeparator && (
                  <div className="flex items-center justify-center my-4">
                    <span className="text-[11px] font-medium bg-gray-200/80 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-3 py-1 rounded-full shadow-2xs">
                      {formatMessageDate(msg.createdAt)}
                    </span>
                  </div>
                )}

                <MessageBubble
                  message={msg}
                  isReadByOther={isRead}
                  onDelete={handleDeleteMessage}
                />
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Box */}
      <div className="p-3 sm:p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        {error && (
          <div className="mb-2 text-xs text-red-500 bg-red-50 dark:bg-red-950/40 p-2 rounded-lg border border-red-200 dark:border-red-900">
            {error}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 p-2 transition-all">
            <Textarea
              ref={textareaRef}
              rows={1}
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ketik pesan ke ${otherUser?.name || '...'}`}
              className="border-0 focus-visible:ring-0 shadow-none resize-none p-0 text-xs sm:text-sm max-h-32 min-h-[24px] bg-transparent"
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={!inputContent.trim() || isSending}
            className="h-10 w-10 p-0 rounded-xl bg-brand-500 hover:bg-brand-600 text-white shrink-0 shadow-xs"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 px-1">
          Tekan <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">Enter</kbd> untuk mengirim, <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">Shift + Enter</kbd> untuk baris baru
        </p>
      </div>
    </div>
  );
}
