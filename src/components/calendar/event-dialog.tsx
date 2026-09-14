'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createCalendarEvent, updateCalendarEvent } from '@/lib/actions/calendar';
import { CalendarEventScope, CalendarEventCategory } from '@prisma/client';
import { Loader2 } from 'lucide-react';

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: string;
  courses: Array<{ id: string; title: string }>;
  defaultDate?: Date | null;
  editItem?: {
    id: string;
    title: string;
    description?: string | null;
    startDate: string;
    endDate?: string | null;
    isAllDay: boolean;
    scope?: string;
    color?: string | null;
    location?: string | null;
  } | null;
  onSuccess: () => void;
}

const COLOR_PRESETS = [
  { name: 'Biru', value: '#3b82f6', bgClass: 'bg-blue-500' },
  { name: 'Hijau', value: '#10b981', bgClass: 'bg-emerald-500' },
  { name: 'Oranye', value: '#f59e0b', bgClass: 'bg-amber-500' },
  { name: 'Merah', value: '#ef4444', bgClass: 'bg-rose-500' },
  { name: 'Ungu', value: '#8b5cf6', bgClass: 'bg-purple-500' },
];

export function EventDialog({
  open,
  onOpenChange,
  userRole,
  courses,
  defaultDate,
  editItem,
  onSuccess,
}: EventDialogProps) {
  const isEditing = !!editItem;

  const getInitialStartDate = () => {
    if (editItem?.startDate) {
      return new Date(editItem.startDate).toISOString().slice(0, 16);
    }
    const d = defaultDate || new Date();
    d.setMinutes(0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const getInitialEndDate = () => {
    if (editItem?.endDate) {
      return new Date(editItem.endDate).toISOString().slice(0, 16);
    }
    const d = defaultDate ? new Date(defaultDate) : new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const [title, setTitle] = useState(editItem?.title || '');
  const [description, setDescription] = useState(editItem?.description || '');
  const [startDate, setStartDate] = useState(getInitialStartDate());
  const [endDate, setEndDate] = useState(getInitialEndDate());
  const [isAllDay, setIsAllDay] = useState(editItem?.isAllDay || false);
  const [scope, setScope] = useState<CalendarEventScope>(
    (editItem?.scope as CalendarEventScope) ||
      (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'
        ? CalendarEventScope.SCHOOL
        : userRole === 'TEACHER'
        ? CalendarEventScope.COURSE
        : CalendarEventScope.PERSONAL)
  );
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [category, setCategory] = useState<CalendarEventCategory>(CalendarEventCategory.ACADEMIC);
  const [color, setColor] = useState(editItem?.color || '#3b82f6');
  const [location, setLocation] = useState(editItem?.location || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Judul agenda tidak boleh kosong');
      return;
    }

    setLoading(true);
    try {
      if (isEditing && editItem) {
        const rawId = editItem.id.replace('custom-', '');
        await updateCalendarEvent(rawId, {
          title,
          description,
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          isAllDay,
          category,
          color,
          location,
        });
      } else {
        await createCalendarEvent({
          title,
          description,
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          isAllDay,
          scope,
          category,
          color,
          location,
          courseId: scope === CalendarEventScope.COURSE ? courseId : undefined,
        });
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan agenda');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#002446] dark:text-white">
            {isEditing ? 'Edit Agenda Kalender' : 'Tambah Agenda Baru'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 text-xs rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs font-semibold">
              Judul Agenda <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Ujian Tengah Semester, Pengayaan Daring"
              className="text-sm"
              required
            />
          </div>

          {/* Scope selection (only for new events) */}
          {!isEditing && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Lingkup Kegiatan</Label>
              <Select
                value={scope}
                onValueChange={(val) => setScope(val as CalendarEventScope)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Pilih lingkup kegiatan" />
                </SelectTrigger>
                <SelectContent>
                  {(userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') && (
                    <SelectItem value={CalendarEventScope.SCHOOL}>
                      🏛️ Agenda Sekolah (Seluruh Siswa & Guru)
                    </SelectItem>
                  )}
                  {(userRole === 'TEACHER' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') && (
                    <SelectItem value={CalendarEventScope.COURSE}>
                      📚 Agenda Kelas / Mata Pelajaran
                    </SelectItem>
                  )}
                  <SelectItem value={CalendarEventScope.PERSONAL}>
                    👤 Catatan Pribadi (Hanya Anda)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Course select if scope is COURSE */}
          {!isEditing && scope === CalendarEventScope.COURSE && courses.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Mata Pelajaran</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Pilih mata pelajaran" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dates & Times */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate" className="text-xs font-semibold">
                Mulai
              </Label>
              <Input
                id="startDate"
                type={isAllDay ? 'date' : 'datetime-local'}
                value={isAllDay ? startDate.slice(0, 10) : startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="endDate" className="text-xs font-semibold">
                Selesai (Opsional)
              </Label>
              <Input
                id="endDate"
                type={isAllDay ? 'date' : 'datetime-local'}
                value={isAllDay ? endDate.slice(0, 10) : endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isAllDay"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="rounded border-gray-300 text-[#002446] focus:ring-blue-500"
            />
            <Label htmlFor="isAllDay" className="text-xs cursor-pointer">
              Sepanjang Hari (All Day)
            </Label>
          </div>

          {/* Location / Link */}
          <div className="space-y-1.5">
            <Label htmlFor="location" className="text-xs font-semibold">
              Lokasi / Ruang / Tautan Daring (Opsional)
            </Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Contoh: Lab Komputer 2 atau https://meet.google.com/..."
              className="text-xs"
            />
          </div>

          {/* Color Presets */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Warna Label</Label>
            <div className="flex items-center gap-2.5 pt-1">
              {COLOR_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.value}
                  onClick={() => setColor(preset.value)}
                  className={`w-6 h-6 rounded-full ${preset.bgClass} transition-all ${
                    color === preset.value
                      ? 'ring-2 ring-offset-2 ring-[#002446] dark:ring-white scale-110'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  title={preset.name}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold">
              Deskripsi Agenda (Opsional)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tambahkan catatan atau detail instruksi..."
              rows={2}
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-[#002446] hover:bg-[#002446]/90 text-white text-xs font-bold"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {isEditing ? 'Simpan Perubahan' : 'Buat Agenda'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
