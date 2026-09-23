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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, UserPlus, RefreshCw, Trash2, CheckCircle2, Search } from 'lucide-react';
import {
  syncCohortToCourse,
  manualEnrollStudent,
  removeEnrollment,
} from '@/lib/actions/cohort';
import { useDialog } from '@/context/DialogContext';

interface EnrolledUser {
  id: string;
  name: string;
  email: string;
  nis: string | null;
  school?: { id: string; name: string; code: string } | null;
}

interface EnrollmentItem {
  id: string;
  method: 'COHORT_SYNC' | 'MANUAL';
  createdAt: Date;
  user: EnrolledUser;
  cohort: { id: string; name: string } | null;
}

interface CohortOption {
  id: string;
  name: string;
  school?: { id: string; name: string; code: string } | null;
  _count: { members: number };
}

interface StudentOption {
  id: string;
  name: string;
  email: string;
  nis: string | null;
  school?: { id: string; name: string; code: string } | null;
}

export function CourseEnrollmentsClient({
  course,
  availableCohorts,
  availableStudents,
}: {
  course: any;
  availableCohorts: CohortOption[];
  availableStudents: StudentOption[];
}) {
  const t = useTranslations('teacherEnrollments');
  const locale = useLocale();
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>(course.enrollments || []);
  const [isCohortSyncOpen, setIsCohortSyncOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState(availableCohorts[0]?.id || '');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSyncCohort = async () => {
    if (!selectedCohortId) return;
    setLoading(true);
    setAlertMsg(null);
    try {
      const res = await syncCohortToCourse(course.id, selectedCohortId);
      const cohortObj = availableCohorts.find((c) => c.id === selectedCohortId);
      setAlertMsg({
        type: 'success',
        text: t('syncSuccess', { name: cohortObj?.name || '', count: res.enrolledCount }),
      });
      setIsCohortSyncOpen(false);
      window.location.reload();
    } catch (err) {
      console.error(err);
      setAlertMsg({ type: 'error', text: t('syncFailed') });
    } finally {
      setLoading(false);
    }
  };

  const handleManualEnroll = async () => {
    if (!selectedStudentId) return;
    setLoading(true);
    setAlertMsg(null);
    try {
      await manualEnrollStudent(course.id, selectedStudentId);
      const studentObj = availableStudents.find((s) => s.id === selectedStudentId);
      if (studentObj) {
        setEnrollments((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            method: 'MANUAL',
            createdAt: new Date(),
            user: studentObj,
            cohort: null,
          },
        ]);
        setAlertMsg({
          type: 'success',
          text: t('manualSuccess', { name: studentObj.name }),
        });
      }
      setIsManualOpen(false);
      setSelectedStudentId('');
    } catch (err) {
      console.error(err);
      setAlertMsg({ type: 'error', text: t('manualFailed') });
    } finally {
      setLoading(false);
    }
  };

  const { showAlert, showConfirm } = useDialog();

  const handleRemoveStudent = async (userId: string, userName: string) => {
    const confirmed = await showConfirm(
      t('removeConfirmDesc', { name: userName }),
      { title: t('removeConfirmTitle'), confirmText: t('removeConfirmBtn'), confirmVariant: 'destructive' }
    );
    if (!confirmed) return;
    setLoading(true);
    try {
      await removeEnrollment(course.id, userId);
      setEnrollments((prev) => prev.filter((e) => e.user.id !== userId));
      await showAlert(t('removeSuccess', { name: userName }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('removeFailed'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const unenrolledStudents = availableStudents.filter(
    (s) => !enrollments.some((e) => e.user.id === s.id)
  );

  const filteredEnrollments = enrollments.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.user.name.toLowerCase().includes(q) ||
      e.user.email.toLowerCase().includes(q) ||
      (e.user.nis || '').includes(q) ||
      (e.cohort?.name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {alertMsg && (
        <div
          className={`p-4 rounded-lg text-sm flex items-center gap-2 ${
            alertMsg.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          {alertMsg.text}
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Main Enrollment Method: Cohort Sync */}
          <Button
            onClick={() => setIsCohortSyncOpen(true)}
            className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white flex items-center gap-2 font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            {t('btnCohortSync')}
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsManualOpen(true)}
            className="border-[#002446] text-[#002446] hover:bg-[#002446] hover:text-white flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            {t('btnManualEnroll')}
          </Button>
        </div>
      </div>

      <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-bold text-[#002446] dark:text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-[#FF8928]" />
              {t('totalEnrolled', { count: enrollments.length })}
            </CardTitle>
            {course.isCrossSchool && (
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-2.5 py-0.5">
                Student Day (Lintas Sekolah)
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700/60">
                <TableHead>{t('thNis')}</TableHead>
                <TableHead>{t('thName')}</TableHead>
                {course.isCrossSchool && <TableHead>Asal Sekolah</TableHead>}
                <TableHead>{t('thEmail')}</TableHead>
                <TableHead>{t('thMethod')}</TableHead>
                <TableHead>{t('thEnrolledAt')}</TableHead>
                <TableHead className="text-right">{t('thAction')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEnrollments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={course.isCrossSchool ? 7 : 6} className="text-center py-12 text-gray-500 dark:text-slate-400">
                    <Users className="h-10 w-10 mx-auto text-gray-300 dark:text-slate-600 mb-2" />
                    {t('emptyState')}
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                      {t('emptyStateHint')}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEnrollments.map((enr) => (
                  <TableRow key={enr.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
                    <TableCell className="font-mono text-xs text-gray-600 dark:text-slate-400">
                      {enr.user.nis || '-'}
                    </TableCell>
                    <TableCell className="font-medium text-[#002446] dark:text-white">
                      {enr.user.name}
                    </TableCell>
                    {course.isCrossSchool && (
                      <TableCell>
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                          {enr.user.school?.name || course.school?.name || 'Sekolah'}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-xs text-gray-500 dark:text-slate-400">
                      {enr.user.email}
                    </TableCell>
                    <TableCell>
                      {enr.method === 'COHORT_SYNC' ? (
                        <Badge className="bg-[#002446] text-white text-xs font-normal">
                          {t('methodCohortSync', { name: enr.cohort?.name || '' })}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs font-normal border-gray-300 dark:border-slate-700">
                          {t('methodManual')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 dark:text-slate-400">
                      {new Date(enr.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveStudent(enr.user.id, enr.user.name)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Cohort Sync */}
      <Dialog open={isCohortSyncOpen} onOpenChange={setIsCohortSyncOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446] flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-[#FF8928]" />
              {t('modalCohortSyncTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              {t('modalCohortSyncDesc')}
            </p>

            <div className="space-y-2">
              <Label htmlFor="cohortSelect">{t('selectCohortLabel')}</Label>
              <select
                id="cohortSelect"
                value={selectedCohortId}
                onChange={(e) => setSelectedCohortId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
              >
                {availableCohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.school?.name ? `[${c.school.name}]` : ''} ({c._count.members} siswa)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCohortSyncOpen(false)}
              className="border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-200"
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleSyncCohort}
              disabled={loading || !selectedCohortId}
              className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white"
            >
              {loading ? t('syncing') : t('btnSync')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Pendaftaran Manual */}
      <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#002446] dark:text-sky-400" />
              {t('modalManualTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {t('modalManualDesc')}
            </p>

            <div className="space-y-2">
              <Label htmlFor="manualStudentSelect" className="text-gray-700 dark:text-slate-300">{t('selectStudentLabel')}</Label>
              <select
                id="manualStudentSelect"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
              >
                <option value="">{t('selectStudentPlaceholder')}</option>
                {unenrolledStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.school?.name ? `[${s.school.name}]` : ''} {s.nis ? `(${t('thNis')}: ${s.nis})` : ''} - {s.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsManualOpen(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleManualEnroll}
              disabled={loading || !selectedStudentId}
              className="bg-[#002446] hover:bg-[#002446]/90 text-white"
            >
              {loading ? t('enrolling') : t('btnManualSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
