'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Bell, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/actions/notification';
import { useRouter } from '@/i18n/navigation';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}

export function NotificationDropdown() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const dateLocale = locale === 'id' ? 'id-ID' : 'en-US';

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  const loadNotifications = async () => {
    try {
      const list = await getUserNotifications();
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.isRead).length);
    } catch {
      // ignore if unauthenticated
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      await markNotificationAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (notif.link) {
      router.push(notif.link);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-gray-600" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-[#FF8928] text-white border-2 border-white"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 sm:w-96 max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto p-0">
        <div className="flex items-center justify-between p-3 border-b bg-gray-50/70">
          <DropdownMenuLabel className="p-0 font-bold text-[#002446]">
            {t('title')} {unreadCount > 0 && t('newBadgeShort', { count: unreadCount })}
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="h-7 text-xs text-blue-600 hover:text-blue-800 p-1 flex items-center gap-1"
            >
              <Check className="h-3 w-3" /> {t('markAllAsRead')}
            </Button>
          )}
        </div>

        <div className="divide-y max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              {t('noNotifications')}
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`p-3 text-left transition-colors cursor-pointer hover:bg-gray-50 ${
                  !n.isRead ? 'bg-amber-50/40' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-xs text-[#002446] flex items-center gap-1.5">
                    {!n.isRead && (
                      <span className="h-2 w-2 rounded-full bg-[#FF8928] flex-shrink-0" />
                    )}
                    <span>{n.title}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                    {new Date(n.createdAt).toLocaleDateString(dateLocale, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {n.message}
                </p>

                {n.link && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#FF8928] font-medium mt-1">
                    {t('openLink')} <ExternalLink className="h-2.5 w-2.5" />
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-2 border-t bg-gray-50/80 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/notifications')}
            className="w-full text-xs text-[#002446] hover:text-[#002446] hover:bg-gray-100 font-bold"
          >
            {t('viewAllHistory')}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
