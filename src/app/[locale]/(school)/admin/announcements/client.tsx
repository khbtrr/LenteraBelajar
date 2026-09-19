'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
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
  const t = useTranslations('adminAnnouncements');
  const locale = useLocale();
  const dateLocale = locale === 'id' ? 'id-ID' : 'en-US';
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateSchoolAnnouncement(editingId, {
          title: title.trim(),
          content: content.trim(),
          targetRole,
          priority,
          isPinned,
          expiresAt: expiresAt || null,
        });

        setAnnouncements((prev) =>
          prev.map((item) => (item.id === editingId ? { ...item, ...updated } : item))
        );
        await showAlert(t('updatedSuccessAlert'), { type: 'success' });
      } else {
        const created = await createSchoolAnnouncement({
          title: title.trim(),
          content: content.trim(),
          targetRole,
          priority,
          isPinned,
          expiresAt: expiresAt || null,
          sendNotification,
        });

        setAnnouncements((prev) => [created as any, ...prev]);
        await showAlert(t('createdSuccessAlert'), { type: 'success' });
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('saveFailedAlert'), { type: 'error' });
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
      await showAlert(t('statusToggledSuccess'), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('statusToggleFailed'), { type: 'error' });
    }
  };

  const handleDelete = async (item: AnnouncementItem) => {
    const confirmed = await showConfirm(
      t('deleteConfirmDesc', { title: item.title }),
      { title: t('deleteConfirmTitle'), confirmText: t('btnConfirmDelete'), confirmVariant: 'destructive' }
    );
    if (!confirmed) return;

    try {
      await deleteSchoolAnnouncement(item.id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== item.id));
      await showAlert(t('deleteSuccessAlert'), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('deleteFailedAlert'), { type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="pl-9 text-xs"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200"
          >
            <option value="ALL">{t('allRoles')}</option>
            <option value={AnnouncementTarget.ALL}>{t('roleAll')}</option>
            <option value={AnnouncementTarget.TEACHER}>{t('roleTeachers')}</option>
            <option value={AnnouncementTarget.STUDENT}>{t('roleStudents')}</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200"
          >
            <option value="ALL">{t('allPriorities')}</option>
            <option value={AnnouncementPriority.NORMAL}>{t('priorityNormal')}</option>
            <option value={AnnouncementPriority.IMPORTANT}>{t('priorityImportant')}</option>
            <option value={AnnouncementPriority.URGENT}>{t('priorityUrgent')}</option>
          </select>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-[#002446] hover:bg-[#001b33] text-white flex items-center gap-1.5 text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          {t('btnCreateAnnouncement')}
        </Button>
      </div>

      {/* Announcements Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/70 dark:bg-gray-800/50">
                <TableHead>{t('colTitle')}</TableHead>
                <TableHead>{t('colTarget')}</TableHead>
                <TableHead>{t('colPriority')}</TableHead>
                <TableHead>{t('colPublished')}</TableHead>
                <TableHead>{t('colExpires')}</TableHead>
                <TableHead>{t('colStatus')}</TableHead>
                <TableHead className="text-right">{t('colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-gray-400 text-xs">
                    {t('emptyAnnouncements')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.isPinned && (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 text-[10px] flex items-center gap-0.5">
                            <Pin className="w-2.5 h-2.5" /> {t('pinnedBadge')}
                          </Badge>
                        )}
                        <span className="font-semibold text-xs text-[#002446] dark:text-white line-clamp-1">
                          {item.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {t('authorBy', {
                          author: item.author.name,
                          date: new Date(item.createdAt).toLocaleDateString(dateLocale, { dateStyle: 'medium' }),
                        })}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {item.targetRole === 'ALL'
                          ? t('roleAll')
                          : item.targetRole === 'TEACHER'
                          ? t('roleTeachers')
                          : t('roleStudents')}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {item.priority === 'URGENT' ? (
                        <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 text-[10px] flex items-center gap-1">
                          <AlertOctagon className="w-3 h-3" /> {t('priorityUrgent')}
                        </Badge>
                      ) : item.priority === 'IMPORTANT' ? (
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 text-[10px] flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {t('priorityImportant')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
                          <Info className="w-3 h-3" /> {t('priorityNormal')}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(item.createdAt).toLocaleDateString(dateLocale, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>

                    <TableCell className="text-xs text-gray-500">
                      {item.expiresAt ? (
                        new Date(item.expiresAt).toLocaleDateString(dateLocale, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      ) : (
                        <span className="text-gray-400 italic">{t('neverExpires')}</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge
                        className={`text-[10px] cursor-pointer transition-colors ${
                          item.isActive
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                        onClick={() => handleToggleActive(item)}
                        title={t('btnToggleActive')}
                      >
                        {item.isActive ? t('statusActive') : t('statusInactive')}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPreviewItem(item)}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
                          title={t('btnPreview')}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(item)}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-amber-600"
                          title={t('btnEdit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(item)}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-rose-600"
                          title={t('btnDelete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Buat / Edit Pengumuman */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
            <DialogHeader className="border-b pb-3">
              <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-[#FF8928]" />
                {editingId ? t('modalEditTitle') : t('modalCreateTitle')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4 flex-1 overflow-y-auto text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="annTitle" className="font-semibold">
                  {t('titleLabel')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="annTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('titlePlaceholder')}
                  required
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-semibold">{t('targetRoleLabel')}</Label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value as AnnouncementTarget)}
                    className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200"
                  >
                    <option value={AnnouncementTarget.ALL}>{t('roleAll')}</option>
                    <option value={AnnouncementTarget.TEACHER}>{t('roleTeachers')}</option>
                    <option value={AnnouncementTarget.STUDENT}>{t('roleStudents')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-semibold">{t('priorityLabel')}</Label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
                    className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200"
                  >
                    <option value={AnnouncementPriority.NORMAL}>{t('priorityNormal')}</option>
                    <option value={AnnouncementPriority.IMPORTANT}>{t('priorityImportant')}</option>
                    <option value={AnnouncementPriority.URGENT}>{t('priorityUrgent')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expiresAt" className="font-semibold">
                  {t('expiresAtLabel')}
                </Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold">
                  {t('contentLabel')} <span className="text-red-500">*</span>
                </Label>
                <RichTextEditor
                  content={content}
                  onChange={setContent}
                  placeholder={t('contentPlaceholder')}
                />
              </div>

              <div className="space-y-2 pt-2 border-t">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#002446]"
                  />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {t('isPinnedLabel')}
                  </span>
                </label>

                {!editingId && (
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendNotification}
                      onChange={(e) => setSendNotification(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#FF8928]"
                    />
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {t('sendNotificationLabel')}
                    </span>
                  </label>
                )}
              </div>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={saving}
                className="text-xs"
              >
                {t('cancelButton')}
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#002446] hover:bg-[#001b33] text-white text-xs font-semibold"
              >
                {saving ? t('saving') : t('saveButton')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Preview Pengumuman */}
      <Dialog open={Boolean(previewItem)} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center gap-2 mb-1">
              {previewItem?.isPinned && (
                <Badge className="bg-amber-100 text-amber-800 text-[10px]">
                  <Pin className="w-2.5 h-2.5 mr-0.5" /> {t('pinnedBadge')}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px]">
                {previewItem?.targetRole === 'ALL'
                  ? t('roleAll')
                  : previewItem?.targetRole === 'TEACHER'
                  ? t('roleTeachers')
                  : t('roleStudents')}
              </Badge>
            </div>
            <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white">
              {previewItem?.title}
            </DialogTitle>
            <div className="text-[11px] text-gray-500 mt-1">
              {previewItem &&
                t('authorBy', {
                  author: previewItem.author.name,
                  date: new Date(previewItem.createdAt).toLocaleDateString(dateLocale, { dateStyle: 'long' }),
                })}
            </div>
          </DialogHeader>

          <div className="py-4 prose prose-sm dark:prose-invert max-w-none text-xs">
            {previewItem && (
              <div dangerouslySetInnerHTML={{ __html: previewItem.content }} />
            )}
          </div>

          <DialogFooter className="border-t pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewItem(null)}
              className="text-xs"
            >
              {t('closeButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
