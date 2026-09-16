'use client';

import React, { useState } from 'react';
import { ConversationSummary } from '@/lib/actions/message';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  conversations: ConversationSummary[];
  selectedId: string | null;
  onSelectConversation: (id: string) => void;
  onOpenNewMessage: () => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelectConversation,
  onOpenNewMessage,
}: ConversationListProps) {
  const [filterQuery, setFilterQuery] = useState('');

  const filteredConversations = conversations.filter((c) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    const nameMatch = c.otherUser?.name.toLowerCase().includes(q);
    const msgMatch = c.lastMessage?.content.toLowerCase().includes(q);
    return nameMatch || msgMatch;
  });

  const formatTime = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const isThisYear = d.getFullYear() === now.getFullYear();
    if (isThisYear) {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    return d.toLocaleDateString([], { year: '2-digit', month: 'numeric', day: 'numeric' });
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

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Header and New Message Button */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-brand-500" />
            <span>Pesan</span>
          </h2>
          <Button
            size="sm"
            onClick={onOpenNewMessage}
            className="h-8 gap-1.5 text-xs bg-brand-500 hover:bg-brand-600 text-white shadow-xs rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Baru</span>
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Cari obrolan..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-gray-50 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 rounded-lg focus-visible:ring-brand-500"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800/60 p-2">
        {filteredConversations.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3 text-gray-400">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {filterQuery ? 'Obrolan tidak ditemukan' : 'Belum ada obrolan'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-[200px] mx-auto">
              {filterQuery
                ? 'Coba kata kunci pencarian yang lain'
                : 'Mulai kirim pesan ke rekan guru atau siswa dengan tombol Baru di atas.'}
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = conv.id === selectedId;
            const otherName = conv.otherUser?.name || 'Pengguna Tidak Dikenal';

            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={cn(
                  'w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 my-0.5 group relative',
                  isSelected
                    ? 'bg-brand-50/80 dark:bg-brand-950/40 text-brand-900 dark:text-brand-100'
                    : 'hover:bg-gray-100/80 dark:hover:bg-gray-800/60 text-gray-900 dark:text-gray-100'
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className="w-11 h-11 border border-gray-100 dark:border-gray-800">
                    {conv.otherUser?.avatar ? (
                      <AvatarImage src={conv.otherUser.avatar} alt={otherName} />
                    ) : (
                      <AvatarFallback className="bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 text-xs font-semibold">
                        {getInitials(otherName)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  {conv.unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-brand-500 border-2 border-white dark:border-gray-900 rounded-full" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={cn(
                          'text-sm truncate font-medium',
                          isSelected && 'text-brand-600 dark:text-brand-400 font-semibold'
                        )}
                      >
                        {otherName}
                      </span>
                      {conv.otherUser?.role && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.2 rounded font-normal shrink-0">
                          {getRoleLabel(conv.otherUser.role)}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-gray-400 shrink-0">
                      {conv.lastMessage
                        ? formatTime(conv.lastMessage.createdAt)
                        : formatTime(conv.lastMessageAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        'text-xs truncate',
                        conv.unreadCount > 0
                          ? 'font-semibold text-gray-900 dark:text-white'
                          : 'text-gray-500 dark:text-gray-400',
                        conv.lastMessage?.isDeleted && 'italic text-gray-400'
                      )}
                    >
                      {conv.lastMessage
                        ? conv.lastMessage.content
                        : 'Belum ada pesan'}
                    </p>

                    {conv.unreadCount > 0 && (
                      <Badge className="h-4 min-w-4 px-1.5 text-[10px] bg-brand-500 text-white rounded-full flex items-center justify-center shrink-0">
                        {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
