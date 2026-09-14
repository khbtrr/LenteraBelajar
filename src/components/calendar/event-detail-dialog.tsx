'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  ArrowRight,
  Edit2,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { CalendarItem } from '@/lib/actions/calendar';
import { useDialog } from '@/context/DialogContext';

interface EventDetailDialogProps {
  item: CalendarItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (item: CalendarItem) => void;
  onDelete?: (id: string) => void;
}

export function EventDetailDialog({
  item,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: EventDetailDialogProps) {
  const { showConfirm } = useDialog();

  if (!item) return null;

  const formatDateRange = (startStr: string, endStr?: string | null, isAllDay?: boolean) => {
    const start = new Date(startStr);
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
    };

    if (isAllDay) {
      return `${start.toLocaleDateString('id-ID', dateOptions)} (Sepanjang Hari)`;
    }

    if (!endStr) {
      return `${start.toLocaleDateString('id-ID', dateOptions)}, ${start.toLocaleTimeString('id-ID', timeOptions)} WIB`;
    }

    const end = new Date(endStr);
    const isSameDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();

    if (isSameDay) {
      return `${start.toLocaleDateString('id-ID', dateOptions)}, ${start.toLocaleTimeString('id-ID', timeOptions)} - ${end.toLocaleTimeString('id-ID', timeOptions)} WIB`;
    }

    return `${start.toLocaleDateString('id-ID', dateOptions)} ${start.toLocaleTimeString('id-ID', timeOptions)} s.d. ${end.toLocaleDateString('id-ID', dateOptions)} ${end.toLocaleTimeString('id-ID', timeOptions)} WIB`;
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'TUGAS':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300">Tugas</Badge>;
      case 'KUIS':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300">Kuis CBT</Badge>;
      case 'PRESENSI':
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300">Presensi</Badge>;
      case 'SEKOLAH':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border-red-300">Agenda Sekolah</Badge>;
      case 'KELAS':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300">Agenda Kelas</Badge>;
      default:
        return <Badge variant="outline">Catatan Pribadi</Badge>;
    }
  };

  const handleDelete = async () => {
    const isConfirmed = await showConfirm(
      `Apakah Anda yakin ingin menghapus agenda "${item.title}"?`,
      {
        title: 'Hapus Agenda',
        confirmText: 'Ya, Hapus',
        cancelText: 'Batal',
        confirmVariant: 'destructive',
      }
    );

    if (isConfirmed && onDelete) {
      onDelete(item.id.replace('custom-', ''));
      onOpenChange(false);
    }
  };

  const isUrl = item.location && (item.location.startsWith('http://') || item.location.startsWith('https://'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            {getCategoryBadge(item.category)}
            {item.courseTitle && (
              <span className="text-xs text-gray-500 font-medium truncate">
                {item.courseTitle}
              </span>
            )}
          </div>
          <DialogTitle className="text-lg font-bold text-[#002446] dark:text-white leading-snug">
            {item.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5 py-2 text-xs">
          {/* Date & Time */}
          <div className="flex items-start gap-2.5 text-gray-700 dark:text-gray-300">
            <Clock className="h-4 w-4 text-[#FF8928] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{formatDateRange(item.startDate, item.endDate, item.isAllDay)}</p>
            </div>
          </div>

          {/* Location */}
          {item.location && (
            <div className="flex items-start gap-2.5 text-gray-700 dark:text-gray-300">
              <MapPin className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              {isUrl ? (
                <a
                  href={item.location}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                >
                  Tautan Pertemuan Online <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <p className="font-medium">{item.location}</p>
              )}
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg border border-gray-100 dark:border-gray-700/60">
              <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                {item.description}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-1.5">
            {item.canEdit && onEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(item);
                }}
                className="text-xs h-8 px-2.5"
              >
                <Edit2 className="h-3.5 w-3.5 mr-1 text-gray-500" /> Edit
              </Button>
            )}
            {item.canEdit && onDelete && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDelete}
                className="text-xs h-8 px-2.5 text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1 text-rose-600" /> Hapus
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {item.link ? (
              <Link href={item.link}>
                <Button
                  size="sm"
                  className="bg-[#002446] hover:bg-[#002446]/90 text-white text-xs font-bold flex items-center gap-1.5 h-8"
                >
                  Buka Kegiatan <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs h-8"
              >
                Tutup
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
