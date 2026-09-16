'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { useDialog } from '@/context/DialogContext';
import {
  createSchoolAnnouncement,
  updateSchoolAnnouncement,
  deleteSchoolAnnouncement,
  toggleSchoolAnnouncementActive,
} from '@/lib/actions/school-announcement';
import { AnnouncementPriority, AnnouncementTarget } from '@prisma/client';
import {
  Megaphone,
  Plus,
  Search,
  Pin,
  AlertTriangle,
  AlertOctagon,
  Info,
  Calendar,
  Eye,
  Edit2,
  Trash2,
  Power,
  Users,
  BellRing,
} from 'lucide-react';

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  targetRole: AnnouncementTarget;
  priority: AnnouncementPriority;
  isPinned: boolean;
  isActive: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  author: {
    id: string;
    name: string;
    email: string;
  };
}

export function AdminAnnouncementsClient({
  initialAnnouncements,
}: {
  initialAnnouncements: AnnouncementItem[];
}) {
  const { showAlert, showConfirm } = useDialog();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(initialAnnouncements);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetRole, setTargetRole] = useState<AnnouncementTarget>(AnnouncementTarget.ALL);
  const [priority, setPriority] = useState<AnnouncementPriority>(AnnouncementPriority.NORMAL);
  const [isPinned, setIsPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [sendNotification, setSendNotification] = useState(true);
  const [saving, setSaving] = useState(false);

  // Preview dialog
  const [previewItem, setPreviewItem] = useState<AnnouncementItem | null>(null);

  const filtered = announcements.filter((item) => {
    const matchSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'ALL' || item.targetRole === roleFilter;
    const matchPriority = priorityFilter === 'ALL' || item.priority === priorityFilter;
    return matchSearch && matchRole && matchPriority;
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setTargetRole(AnnouncementTarget.ALL);
    setPriority(AnnouncementPriority.NORMAL);
    setIsPinned(false);
    setExpiresAt('');
    setSendNotification(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: AnnouncementItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setContent(item.content);
    setTargetRole(item.targetRole);
    setPriority(item.priority);
    setIsPinned(item.isPinned);
    setExpiresAt(item.expiresAt ? new Date(item.expiresAt).toISOString().split('T')[0] : '');
    setSendNotification(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      await showAlert('Judul dan isi konten pengumuman tidak boleh kosong', { type: 'error' });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateSchoolAnnouncement(editingId, {
          title,
          content,
          targetRole,
          priority,
          isPinned,
          expiresAt: expiresAt ? expiresAt : null,
        });
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === editingId ? { ...a, ...updated } : a))
        );
        await showAlert('Pengumuman berhasil diperbarui!', { type: 'success' });
      } else {
        const created = await createSchoolAnnouncement({
          title,
          content,
          targetRole,
          priority,
          isPinned,
          expiresAt: expiresAt ? expiresAt : null,
          sendNotification,
        });
        setAnnouncements((prev) => [created as any, ...prev]);
        await showAlert('Pengumuman sekolah berhasil diterbitkan!', { type: 'success' });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal menyimpan pengumuman', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: AnnouncementItem) => {
    try {
      const updated = await toggleSchoolAnnouncementActive(item.id);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, isActive: updated.isActive } : a))
      );
      await showAlert(
        `Pengumuman "${item.title}" sekarang ${updated.isActive ? 'AKTIF' : 'NONAKTIF'}`,
        { type: 'success' }
      );
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal mengubah status', { type: 'error' });
    }
  };

  const handleDelete = async (item: AnnouncementItem) => {
    const confirmed = await showConfirm(
      `Apakah Anda yakin ingin menghapus pengumuman "${item.title}"?`,
      {
        title: 'Hapus Pengumuman',
        confirmText: 'Ya, Hapus',
        cancelText: 'Batal',
      }
    );
    if (!confirmed) return;

    try {
      await deleteSchoolAnnouncement(item.id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== item.id));
      await showAlert('Pengumuman berhasil dihapus', { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal menghapus pengumuman', { type: 'error' });
    }
  };

  const getPriorityBadge = (p: AnnouncementPriority) => {
    switch (p) {
      case 'URGENT':
        return (
          <Badge className="bg-rose-600 text-white hover:bg-rose-700 flex items-center gap-1">
            <AlertOctagon className="w-3 h-3" />
            Mendesak
          </Badge>
        );
      case 'IMPORTANT':
        return (
          <Badge className="bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Penting
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Info className="w-3 h-3 text-blue-600" />
            Biasa
          </Badge>
        );
    }
  };

  const getTargetBadge = (target: AnnouncementTarget) => {
    switch (target) {
      case 'TEACHER':
        return <Badge variant="outline" className="text-amber-700 border-amber-300">Khusus Guru</Badge>;
      case 'STUDENT':
        return <Badge variant="outline" className="text-blue-700 border-blue-300">Khusus Siswa</Badge>;
      default:
        return <Badge variant="outline" className="text-emerald-700 border-emerald-300">Semua</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pengumuman..."
              className="pl-9 text-sm"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300"
          >
            <option value="ALL">Semua Target</option>
            <option value="TEACHER">Khusus Guru</option>
            <option value="STUDENT">Khusus Siswa</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300"
          >
            <option value="ALL">Semua Prioritas</option>
            <option value="NORMAL">Biasa</option>
            <option value="IMPORTANT">Penting</option>
            <option value="URGENT">Mendesak</option>
          </select>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-[#002446] hover:bg-[#001b33] text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Buat Pengumuman
        </Button>
      </div>

      {/* Announcements Table */}
      <Card className="border-gray-200 dark:border-gray-800 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/70 dark:bg-gray-800/50">
                <TableHead className="w-[45%]">Judul & Cuplikan</TableHead>
                <TableHead>Prioritas</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Masa Berlaku</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? (
                filtered.map((item) => {
                  const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
                  return (
                    <TableRow key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {item.isPinned && (
                              <span title="Disematkan di paling atas">
                                <Pin className="w-3.5 h-3.5 text-[#FF8928] fill-[#FF8928]" />
                              </span>
                            )}
                            <span className="font-bold text-sm text-[#002446] dark:text-white">
                              {item.title}
                            </span>
                          </div>
                          <div
                            className="text-xs text-gray-500 line-clamp-1 max-w-md"
                            dangerouslySetInnerHTML={{
                              __html: item.content.replace(/<[^>]+>/g, ' ').slice(0, 100),
                            }}
                          />
                          <div className="text-[10px] text-gray-400">
                            Dibuat: {new Date(item.createdAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })} oleh {item.author?.name || 'Admin'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                      <TableCell>{getTargetBadge(item.targetRole)}</TableCell>
                      <TableCell>
                        {item.expiresAt ? (
                          <div className="text-xs space-y-0.5">
                            <div className={isExpired ? 'text-rose-600 font-semibold' : 'text-gray-600 dark:text-gray-400'}>
                              {new Date(item.expiresAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                            </div>
                            {isExpired && <span className="text-[10px] text-rose-500 font-medium">Kedaluwarsa</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Permanen</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                            item.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          {item.isActive ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-[#002446] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            title="Lihat Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-brand-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-400 text-sm">
                    Belum ada pengumuman yang sesuai.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[#002446] dark:text-white">
              <Megaphone className="w-5 h-5 text-[#FF8928]" />
              {editingId ? 'Edit Pengumuman Sekolah' : 'Buat Pengumuman Sekolah Baru'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="font-medium">
                Judul Pengumuman <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Jadwal Pelaksanaan Asesmen Akhir Semester Ganjil"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="targetRole" className="font-medium">
                  Target Penerima
                </Label>
                <select
                  id="targetRole"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as AnnouncementTarget)}
                  className="w-full text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg p-2.5"
                >
                  <option value={AnnouncementTarget.ALL}>Semua Civitas (Guru & Siswa)</option>
                  <option value={AnnouncementTarget.TEACHER}>Khusus Guru Saja</option>
                  <option value={AnnouncementTarget.STUDENT}>Khusus Siswa Saja</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="priority" className="font-medium">
                  Tingkat Prioritas
                </Label>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
                  className="w-full text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg p-2.5"
                >
                  <option value={AnnouncementPriority.NORMAL}>Biasa (Tampil di kartu informasi)</option>
                  <option value={AnnouncementPriority.IMPORTANT}>Penting (Aksen warna peringatan)</option>
                  <option value={AnnouncementPriority.URGENT}>Mendesak / Darurat (Banner atas wajib)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="expiresAt" className="font-medium">
                  Tanggal Kedaluwarsa (Opsional)
                </Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="isPinned"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#002446] cursor-pointer"
                />
                <Label htmlFor="isPinned" className="text-sm font-medium cursor-pointer">
                  Sematkan di paling atas (Pin to Top)
                </Label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-medium">
                Konten & Informasi Pengumuman <span className="text-red-500">*</span>
              </Label>
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Tuliskan isi pengumuman sekolah secara lengkap..."
              />
            </div>

            {!editingId && (
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl flex items-center gap-3">
                <input
                  type="checkbox"
                  id="sendNotif"
                  checked={sendNotification}
                  onChange={(e) => setSendNotification(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                />
                <Label htmlFor="sendNotif" className="text-xs font-medium text-blue-900 dark:text-blue-200 cursor-pointer flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5 text-blue-600" />
                  Kirimkan notifikasi lonceng ke seluruh pengguna target secara otomatis
                </Label>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={saving}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#002446] hover:bg-[#001b33] text-white"
              >
                {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Terbitkan Pengumuman'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          {previewItem && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  {getPriorityBadge(previewItem.priority)}
                  {getTargetBadge(previewItem.targetRole)}
                  {previewItem.isPinned && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      Disematkan
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white text-left">
                  {previewItem.title}
                </DialogTitle>
                <div className="text-xs text-gray-500 text-left">
                  Diterbitkan {new Date(previewItem.createdAt).toLocaleDateString('id-ID', { dateStyle: 'full' })}
                </div>
              </DialogHeader>

              <div
                className="prose dark:prose-invert max-w-none text-sm leading-relaxed border-t border-b border-gray-100 dark:border-gray-800 py-4"
                dangerouslySetInnerHTML={{ __html: previewItem.content }}
              />

              <DialogFooter>
                <Button variant="outline" onClick={() => setPreviewItem(null)}>
                  Tutup
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
