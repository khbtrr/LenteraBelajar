'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import {
  getAllUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearReadNotifications,
} from '@/lib/actions/notification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Check,
  Trash2,
  ExternalLink,
  ClipboardList,
  HelpCircle,
  Sparkles,
  Award,
  Megaphone,
  MessageSquare,
  Clock,
  CheckCheck,
  Filter,
} from 'lucide-react';
import { useDialog } from '@/context/DialogContext';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}

export function NotificationsClient({
  initialNotifications,
}: {
  initialNotifications: NotificationItem[];
}) {
  const router = useRouter();
  const { showAlert } = useDialog();

  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [activeTab, setActiveTab] = useState<
    'ALL' | 'UNREAD' | 'ASSIGNMENT_QUIZ' | 'GRADE' | 'ANNOUNCEMENT_FORUM'
  >('ALL');
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleTabChange = async (
    tab: 'ALL' | 'UNREAD' | 'ASSIGNMENT_QUIZ' | 'GRADE' | 'ANNOUNCEMENT_FORUM'
  ) => {
    setActiveTab(tab);
    setLoading(true);
    try {
      const data = await getAllUserNotifications({ category: tab });
      setNotifications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      showAlert('Seluruh notifikasi telah ditandai sudah dibaca.', { type: 'success' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearRead = async () => {
    try {
      await clearReadNotifications();
      setNotifications((prev) => prev.filter((n) => !n.isRead));
      showAlert('Notifikasi yang sudah dibaca berhasil dibersihkan.', { type: 'success' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleClickItem = async (item: NotificationItem) => {
    if (!item.isRead) {
      await markNotificationAsRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
    }

    if (item.link) {
      router.push(item.link);
    }
  };

  const handleDeleteItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ASSIGNMENT':
        return (
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <ClipboardList className="h-5 w-5" />
          </div>
        );
      case 'QUIZ':
        return (
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF8928] flex items-center justify-center shrink-0">
            <HelpCircle className="h-5 w-5" />
          </div>
        );
      case 'REMEDIAL':
        return (
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
        );
      case 'GRADE':
      case 'SUBMISSION':
        return (
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Award className="h-5 w-5" />
          </div>
        );
      case 'COURSE_ANNOUNCEMENT':
      case 'ANNOUNCEMENT':
        return (
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Megaphone className="h-5 w-5" />
          </div>
        );
      case 'FORUM_THREAD':
      case 'FORUM_REPLY':
      case 'FORUM':
        return (
          <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <MessageSquare className="h-5 w-5" />
          </div>
        );
      case 'DEADLINE':
        return (
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
            <Bell className="h-5 w-5" />
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#002446]">Pusat Notifikasi</h1>
            {unreadCount > 0 && (
              <Badge className="bg-[#FF8928] text-white text-xs font-bold px-2 py-0.5">
                {unreadCount} Baru
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Riwayat seluruh pemberitahuan akademik, tugas, kuis, nilai, dan forum diskusi Anda.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-xs text-[#002446] border-[#002446]/30 hover:bg-gray-100 flex items-center gap-1.5"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Tandai Semua Dibaca</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearRead}
            className="text-xs text-gray-500 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Bersihkan Terbaca</span>
          </Button>
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex flex-wrap gap-1 bg-white p-1.5 rounded-xl border shadow-xs">
        <button
          type="button"
          onClick={() => handleTabChange('ALL')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'ALL'
              ? 'bg-[#002446] text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Semua
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('UNREAD')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'UNREAD'
              ? 'bg-[#002446] text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <span>Belum Dibaca</span>
          {unreadCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-[#FF8928]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('ASSIGNMENT_QUIZ')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'ASSIGNMENT_QUIZ'
              ? 'bg-[#002446] text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Tugas & Kuis
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('GRADE')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'GRADE'
              ? 'bg-[#002446] text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Nilai & Hasil
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('ANNOUNCEMENT_FORUM')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'ANNOUNCEMENT_FORUM'
              ? 'bg-[#002446] text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Pengumuman & Forum
        </button>
      </div>

      {/* Notifications List */}
      <Card className="border bg-white shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-xs text-gray-500">
              Memuat notifikasi...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center space-y-2 text-gray-400">
              <Bell className="h-12 w-12 mx-auto text-gray-300" />
              <div className="text-sm font-bold text-gray-700">Tidak Ada Notifikasi</div>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Anda sudah melihat semua pemberitahuan pada kategori ini.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleClickItem(item)}
                  className={`p-4 flex items-start justify-between gap-4 transition-colors cursor-pointer hover:bg-gray-50 ${
                    !item.isRead ? 'bg-amber-50/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-3.5 flex-1">
                    {getNotificationIcon(item.type)}

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#002446]">
                          {item.title}
                        </span>
                        {!item.isRead && (
                          <span className="h-2 w-2 rounded-full bg-[#FF8928] shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {item.message}
                      </p>

                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-[11px] text-gray-400">
                          {new Date(item.createdAt).toLocaleString('id-ID', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {item.link && (
                          <span className="text-[11px] text-[#FF8928] font-semibold flex items-center gap-1">
                            Buka tautan <ExternalLink className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 self-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteItem(e, item.id)}
                      className="h-8 w-8 text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
