'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  ContactableUser,
  getContactableUsers,
  getOrCreateConversation,
} from '@/lib/actions/message';
import { Search, Loader2, UserPlus, BookOpen } from 'lucide-react';

interface NewMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectConversation: (conversationId: string) => void;
}

export function NewMessageDialog({
  open,
  onOpenChange,
  onSelectConversation,
}: NewMessageDialogProps) {
  const t = useTranslations('messages');
  const tRoles = useTranslations('roles');

  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<ContactableUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setUsers([]);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const results = await getContactableUsers(search);
        if (isMounted) {
          setUsers(results);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || t('failedLoadContacts'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [search, open, t]);

  const handleSelectUser = (user: ContactableUser) => {
    startTransition(async () => {
      try {
        setError(null);
        const { conversationId } = await getOrCreateConversation(user.id);
        onOpenChange(false);
        onSelectConversation(conversationId);
      } catch (err: any) {
        setError(err?.message || t('failedStartChat'));
      }
    });
  };

  const getRoleLabel = (role: string) => {
    try {
      return tRoles(role);
    } catch {
      return role;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'TEACHER':
        return 'default' as const;
      case 'STUDENT':
        return 'secondary' as const;
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return 'destructive' as const;
      default:
        return 'outline' as const;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <UserPlus className="w-5 h-5 text-brand-500" />
            <span>{t('newChatTitle')}</span>
          </DialogTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('newChatSubtitle')}
          </p>
        </DialogHeader>

        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder={t('searchContactPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              autoFocus
            />
          </div>
        </div>

        {error && (
          <div className="mx-4 my-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 p-2">
          {isLoading || isPending ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              <span>{t('loadingContacts')}</span>
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-xs">
              {search
                ? t('noContactsFound')
                : t('noContactsAvailable')}
            </div>
          ) : (
            users.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                disabled={isPending}
                className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="w-10 h-10 shrink-0">
                    {user.avatar ? (
                      <AvatarImage src={user.avatar} alt={user.name} />
                    ) : (
                      <AvatarFallback className="bg-brand-100 text-brand-700 text-xs font-semibold">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    )}
                  </Avatar>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-brand-500 transition-colors">
                        {user.name}
                      </span>
                      <Badge
                        variant={getRoleBadgeVariant(user.role)}
                        className="text-[10px] px-1.5 py-0 h-4"
                      >
                        {getRoleLabel(user.role)}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                      <BookOpen className="w-3 h-3 shrink-0 text-gray-400" />
                      <span className="truncate">
                        {user.sharedCourses.join(', ') || t('sharedClass')}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
