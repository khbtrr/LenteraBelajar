'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { FormattedMessage } from '@/lib/actions/message';
import { cn } from '@/lib/utils';
import { Trash2, Check, CheckCheck, Ban } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface MessageBubbleProps {
  message: FormattedMessage;
  isReadByOther?: boolean;
  onDelete?: (messageId: string) => Promise<void>;
  showAvatar?: boolean;
}

export function MessageBubble({
  message,
  isReadByOther,
  onDelete,
  showAvatar = true,
}: MessageBubbleProps) {
  const t = useTranslations('messages');
  const locale = useLocale();
  const dateLocale = locale === 'id' ? 'id-ID' : 'en-US';

  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString(dateLocale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;
    try {
      setIsDeleting(true);
      await onDelete(message.id);
    } catch (err) {
      console.error('Failed to delete message:', err);
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
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

  if (message.isMine) {
    return (
      <div className="group relative flex flex-col items-end gap-1 mb-3">
        <div className="flex items-end gap-2 max-w-[80%] sm:max-w-[70%]">
          {/* Delete message button (on hover) */}
          {!message.isDeleted && onDelete && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
              {showConfirm ? (
                <div className="flex items-center gap-1 bg-white dark:bg-gray-800 shadow-md rounded-lg p-1 text-xs border border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-300 text-[11px] px-1">{t('deletePrompt')}</span>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 p-1 rounded font-medium"
                  >
                    {t('deleteYes')}
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded"
                  >
                    {t('deleteCancel')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowConfirm(true)}
                  title={t('deleteTooltip')}
                  className="text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Bubble */}
          <div
            className={cn(
              'px-4 py-2.5 rounded-2xl text-sm break-words shadow-sm',
              message.isDeleted
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 italic rounded-br-xs border border-gray-200 dark:border-gray-700 flex items-center gap-1.5'
                : 'bg-brand-500 text-white rounded-br-xs'
            )}
          >
            {message.isDeleted ? (
              <>
                <Ban className="w-3.5 h-3.5 shrink-0" />
                <span>{t('deletedMessage')}</span>
              </>
            ) : (
              <span className="whitespace-pre-wrap">{message.content}</span>
            )}
          </div>
        </div>

        {/* Time and read receipts */}
        <div className="flex items-center gap-1 text-[11px] text-gray-400 pr-1">
          <span>{formatTime(message.createdAt)}</span>
          {!message.isDeleted && (
            isReadByOther ? (
              <span title={t('readReceipt')}>
                <CheckCheck className="w-3.5 h-3.5 text-brand-500 inline" />
              </span>
            ) : (
              <span title={t('sentReceipt')}>
                <Check className="w-3.5 h-3.5 text-gray-400 inline" />
              </span>
            )
          )}
        </div>
      </div>
    );
  }

  // Incoming message
  return (
    <div className="flex items-start gap-2.5 mb-3 max-w-[85%] sm:max-w-[75%]">
      {showAvatar && (
        <Avatar className="w-8 h-8 shrink-0 mt-0.5">
          {message.sender.avatar ? (
            <AvatarImage src={message.sender.avatar} alt={message.sender.name} />
          ) : (
            <AvatarFallback className="bg-brand-100 text-brand-700 text-xs font-medium">
              {getInitials(message.sender.name)}
            </AvatarFallback>
          )}
        </Avatar>
      )}

      <div className="flex flex-col items-start gap-1">
        <div
          className={cn(
            'px-4 py-2.5 rounded-2xl text-sm break-words shadow-sm',
            message.isDeleted
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 italic rounded-bl-xs border border-gray-200 dark:border-gray-700 flex items-center gap-1.5'
              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-xs border border-gray-100 dark:border-gray-700/60'
          )}
        >
          {message.isDeleted ? (
            <>
              <Ban className="w-3.5 h-3.5 shrink-0" />
              <span>{t('deletedMessage')}</span>
            </>
          ) : (
            <span className="whitespace-pre-wrap">{message.content}</span>
          )}
        </div>

        <span className="text-[11px] text-gray-400 pl-1">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}
