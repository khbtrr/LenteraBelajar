'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { reviewCourseRequest } from '@/lib/actions/course';
import { useDialog } from '@/context/DialogContext';

interface CourseRequestItem {
  id: string;
  title: string;
  description: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote: string | null;
  createdAt: Date;
  requester: { id: string; name: string; email: string };
}

export function CourseRequestsClient({
  initialRequests,
}: {
  initialRequests: any[];
}) {
  const t = useTranslations('adminCourseRequests');
  const locale = useLocale();
  const dateLocale = locale === 'id' ? 'id-ID' : 'en-US';
  const { showAlert } = useDialog();
  const [requests, setRequests] = useState<CourseRequestItem[]>(initialRequests);
  const [selectedRequest, setSelectedRequest] = useState<CourseRequestItem | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  const handleReview = async () => {
    if (!selectedRequest || !reviewAction) return;
    setLoading(true);
    try {
      await reviewCourseRequest(selectedRequest.id, reviewAction, adminNote || undefined);

      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id
            ? {
                ...r,
                status: reviewAction === 'APPROVE' ? 'APPROVED' : 'REJECTED',
                adminNote: adminNote || null,
              }
            : r
        )
      );
      setSelectedRequest(null);
      setReviewAction(null);
      setAdminNote('');
      await showAlert(
        reviewAction === 'APPROVE'
          ? t('approveSuccessAlert')
          : t('rejectSuccessAlert'),
        { type: reviewAction === 'APPROVE' ? 'success' : 'info' }
      );
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('processFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('colRequestTitle')}</TableHead>
                <TableHead>{t('colTeacher')}</TableHead>
                <TableHead>{t('colDate')}</TableHead>
                <TableHead>{t('colStatus')}</TableHead>
                <TableHead>{t('colAdminNote')}</TableHead>
                <TableHead className="text-right">{t('colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-gray-500 dark:text-gray-400">
                    {t('emptyRequests')}
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div className="font-semibold text-[#002446] dark:text-white">
                        {req.title}
                      </div>
                      {req.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                          {req.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      <div>{req.requester.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{req.requester.email}</div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 dark:text-gray-300">
                      {new Date(req.createdAt).toLocaleDateString(dateLocale, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          req.status === 'APPROVED'
                            ? 'bg-green-600 text-white'
                            : req.status === 'REJECTED'
                            ? 'bg-red-500 text-white'
                            : 'bg-amber-500 text-white'
                        }
                      >
                        {req.status === 'APPROVED' ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {t('statusApproved')}
                          </span>
                        ) : req.status === 'REJECTED' ? (
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
                    <TableCell className="text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {req.adminNote || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === 'PENDING' && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(req);
                              setReviewAction('APPROVE');
                              setAdminNote('');
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t('btnApprove')}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedRequest(req);
                              setReviewAction('REJECT');
                              setAdminNote('');
                            }}
                            className="h-8 text-xs"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> {t('btnReject')}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Review Request */}
      <Dialog
        open={Boolean(selectedRequest && reviewAction)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRequest(null);
            setReviewAction(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white flex items-center gap-2">
              {reviewAction === 'APPROVE' ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              {t('reviewModalTitle')}
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg space-y-1 text-sm">
                <div>
                  <span className="text-gray-500">{t('courseTitleLabel')}: </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedRequest.title}</span>
                </div>
                <div>
                  <span className="text-gray-500">{t('requesterLabel')}: </span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{selectedRequest.requester.name}</span>
                </div>
                {selectedRequest.description && (
                  <div className="text-xs text-gray-500 pt-1 border-t mt-1">
                    {selectedRequest.description}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="revNote">{t('adminNoteLabel')}</Label>
                <Input
                  id="revNote"
                  placeholder={t('adminNotePlaceholder')}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedRequest(null);
                setReviewAction(null);
              }}
            >
              {t('cancelButton')}
            </Button>
            <Button
              onClick={handleReview}
              disabled={loading}
              className={
                reviewAction === 'APPROVE'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }
            >
              {loading
                ? t('processing')
                : reviewAction === 'APPROVE'
                ? t('confirmApprove')
                : t('confirmReject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
