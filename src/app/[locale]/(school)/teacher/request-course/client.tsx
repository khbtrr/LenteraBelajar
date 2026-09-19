'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { requestCourse } from '@/lib/actions/course';
import { useDialog } from '@/context/DialogContext';

interface RequestItem {
  id: string;
  title: string;
  description: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote: string | null;
  createdAt: Date;
}

interface AcademicYear {
  id: string;
  name: string;
  status: string;
}

interface Category {
  id: string;
  name: string;
  parent?: { id: string; name: string } | null;
}

export function TeacherRequestCourseClient({
  initialRequests,
  academicYears,
  categories,
}: {
  initialRequests: RequestItem[];
  academicYears: AcademicYear[];
  categories: Category[];
}) {
  const t = useTranslations('teacherRequestCourse');
  const locale = useLocale();
  const { showAlert } = useDialog();
  const [requests, setRequests] = useState<RequestItem[]>(initialRequests);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [academicYearId, setAcademicYearId] = useState(
    academicYears.find((y) => y.status === 'ACTIVE')?.id || academicYears[0]?.id || ''
  );
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYearId) {
      await showAlert(t('selectYearWarn'), { type: 'warning' });
      return;
    }
    setLoading(true);
    setSuccessMsg('');
    try {
      const newReq = await requestCourse({
        title,
        description,
        academicYearId,
        categoryId: categoryId || undefined,
      });

      setRequests((prev) => [newReq, ...prev]);
      setTitle('');
      setDescription('');
      setSuccessMsg(t('successAlert'));
      await showAlert(t('successAlert'), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('failedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Form Request */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Send className="h-5 w-5 text-accent-500" /> {t('formTitle')}
          </CardTitle>
          <CardDescription>
            {t('formDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {successMsg && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400 text-sm rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                {successMsg}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reqTitle" className="text-gray-700 dark:text-gray-300">{t('courseTitle')}</Label>
              <Input
                id="reqTitle"
                placeholder={t('courseTitlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reqDesc" className="text-gray-700 dark:text-gray-300">{t('planDesc')}</Label>
              <Input
                id="reqDesc"
                placeholder={t('planDescPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reqYear" className="text-gray-700 dark:text-gray-300">{t('academicYear')}</Label>
                <select
                  id="reqYear"
                  value={academicYearId}
                  onChange={(e) => setAcademicYearId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-brand-500 transition-colors"
                  required
                >
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.status === 'ACTIVE' ? t('activeTag') : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reqCat" className="text-gray-700 dark:text-gray-300">{t('category')}</Label>
                <select
                  id="reqCat"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-brand-500 transition-colors"
                >
                  <option value="">{t('selectCategory')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parent ? `${c.parent.name} → ${c.name}` : `${c.name} ${t('yearSuffix')}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="bg-accent-500 hover:bg-accent-600 text-white flex items-center gap-2 shadow-xs transition-colors"
              >
                <Send className="h-4 w-4" />
                {loading ? t('submitting') : t('btnSubmit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Riwayat Pengajuan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold">
            {t('historyTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('thCourseTitle')}</TableHead>
                <TableHead>{t('thSubmitDate')}</TableHead>
                <TableHead>{t('thStatus')}</TableHead>
                <TableHead>{t('thAdminNote')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">
                    {t('emptyHistory')}
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-semibold text-gray-900 dark:text-white">{r.title}</div>
                      {r.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                          {r.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(r.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          r.status === 'APPROVED'
                            ? 'bg-green-600 text-white'
                            : r.status === 'REJECTED'
                            ? 'bg-red-500 text-white'
                            : 'bg-amber-500 text-white'
                        }
                      >
                        {r.status === 'APPROVED' ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {t('statusApproved')}
                          </span>
                        ) : r.status === 'REJECTED' ? (
                          <span className="flex items-center gap-1">
                            <XCircle className="h-3 w-3" /> {t('statusRejected')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {t('statusPending')}
                          </span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                      {r.adminNote || t('noNote')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
