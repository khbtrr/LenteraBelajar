'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Calendar, Plus, Archive, CheckCircle, AlertTriangle } from 'lucide-react';
import {
  createAcademicYear,
  setActiveAcademicYear,
  archiveAcademicYear,
} from '@/lib/actions/academic-year';
import { useDialog } from '@/context/DialogContext';

interface AcademicYear {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: 'ACTIVE' | 'ARCHIVED';
  _count?: {
    courses: number;
  };
}

export function AcademicYearsClient({
  initialYears,
}: {
  initialYears: AcademicYear[];
}) {
  const t = useTranslations('adminAcademicYears');
  const locale = useLocale();
  const dateLocale = locale === 'id' ? 'id-ID' : 'en-US';
  const { showAlert, showConfirm } = useDialog();
  const [years, setYears] = useState<AcademicYear[]>(initialYears);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<AcademicYear | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [makeActive, setMakeActive] = useState(true);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await createAcademicYear({
        name,
        startDate,
        endDate,
        makeActive,
      });

      if (makeActive) {
        setYears((prev) =>
          prev.map((y) => ({
            ...y,
            status: 'ARCHIVED',
          }))
        );
      }

      setYears((prev) => [
        { ...created, _count: { courses: 0 } },
        ...prev,
      ]);
      setIsCreateOpen(false);
      setName('');
      setStartDate('');
      setEndDate('');
      await showAlert(t('yearCreatedAlert', { name: created.name }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('yearCreateFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = async (id: string) => {
    const confirmed = await showConfirm(
      t('activateConfirmDesc'),
      { title: t('activateConfirmTitle'), confirmText: t('btnConfirmActivate'), cancelText: t('cancelButton') }
    );
    if (!confirmed) {
      return;
    }
    setLoading(true);
    try {
      await setActiveAcademicYear(id);
      setYears((prev) =>
        prev.map((y) => ({
          ...y,
          status: y.id === id ? 'ACTIVE' : 'ARCHIVED',
        }))
      );
      await showAlert(t('activateSuccessAlert'), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('activateFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setLoading(true);
    try {
      await archiveAcademicYear(archiveTarget.id);
      setYears((prev) =>
        prev.map((y) =>
          y.id === archiveTarget.id ? { ...y, status: 'ARCHIVED' } : y
        )
      );
      setArchiveTarget(null);
      await showAlert(t('archiveSuccessAlert'), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('archiveFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-[#002446] hover:bg-[#002446]/90 dark:bg-brand-600 dark:hover:bg-brand-700 text-white flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> {t('btnCreateYear')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {years.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
            {t('emptyYears')}
          </div>
        ) : (
          years.map((year) => (
            <Card
              key={year.id}
              className={`transition-all ${
                year.status === 'ACTIVE'
                  ? 'border-2 border-[#FF8928] shadow-md dark:border-[#FF8928]/80'
                  : 'opacity-80 dark:border-gray-800'
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-bold text-[#002446] dark:text-white flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-[#002446] dark:text-blue-400" />
                  {year.name}
                </CardTitle>
                <Badge
                  className={
                    year.status === 'ACTIVE'
                      ? 'bg-[#FF8928] text-white hover:bg-[#FF8928]/90'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }
                >
                  {year.status === 'ACTIVE' ? t('activeBadge') : t('archivedBadge')}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <div>
                    {t('period', {
                      start: new Date(year.startDate).toLocaleDateString(dateLocale, {
                        month: 'short',
                        year: 'numeric',
                      }),
                      end: new Date(year.endDate).toLocaleDateString(dateLocale, {
                        month: 'short',
                        year: 'numeric',
                      }),
                    })}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {t('coursesCount', { count: year._count?.courses || 0 })}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  {year.status !== 'ACTIVE' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetActive(year.id)}
                      disabled={loading}
                      className="text-xs text-[#002446] hover:bg-[#002446] hover:text-white dark:text-white dark:hover:bg-brand-600 flex items-center gap-1"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> {t('btnSetActive')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setArchiveTarget(year)}
                      disabled={loading}
                      className="text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-1"
                    >
                      <Archive className="h-3.5 w-3.5" /> {t('btnArchive')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal Tambah Tahun Ajaran */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white">
                {t('createModalTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="yName">{t('nameLabel')}</Label>
                <Input
                  id="yName"
                  placeholder={t('namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="yStart">{t('startDateLabel')}</Label>
                  <Input
                    id="yStart"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yEnd">{t('endDateLabel')}</Label>
                  <Input
                    id="yEnd"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="yActive"
                  checked={makeActive}
                  onChange={(e) => setMakeActive(e.target.checked)}
                  className="rounded border-gray-300 text-[#002446] focus:ring-[#002446]"
                />
                <Label htmlFor="yActive" className="text-sm font-normal cursor-pointer">
                  {t('makeActiveLabel')}
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                {t('cancelButton')}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#002446] hover:bg-[#002446]/90 dark:bg-brand-600 dark:hover:bg-brand-700 text-white"
              >
                {loading ? t('saving') : t('saveButton')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Arsipkan */}
      <Dialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> {t('archiveModalTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-gray-600 dark:text-gray-300">
            {archiveTarget && t('archiveWarningText', { name: archiveTarget.name })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveTarget(null)}
              disabled={loading}
            >
              {t('cancelButton')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchive}
              disabled={loading}
            >
              {loading ? t('archiving') : t('btnConfirmArchive')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
