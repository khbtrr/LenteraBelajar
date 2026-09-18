'use client';

import { useState } from 'react';
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
  const { showAlert } = useDialog();
  const [requests, setRequests] = useState<CourseRequestItem[]>(initialRequests);
  const [selectedRequest, setSelectedRequest] = useState<CourseRequestItem | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading] = useState(false);

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
          ? 'Pengajuan course berhasil disetujui!'
          : 'Pengajuan course ditolak.',
        { type: reviewAction === 'APPROVE' ? 'success' : 'info' }
      );
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal memproses pengajuan course', { type: 'error' });
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
                <TableHead>Judul Pengajuan</TableHead>
                <TableHead>Guru Pemohon</TableHead>
                <TableHead>Tanggal Pengajuan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Catatan Admin</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-gray-500 dark:text-gray-400">
                    Belum ada pengajuan course.
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
                      {new Date(req.createdAt).toLocaleDateString('id-ID', {
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
                            <CheckCircle2 className="h-3 w-3" /> Disetujui
                          </span>
                        ) : req.status === 'REJECTED' ? (
                          <span className="flex items-center gap-1">
                            <XCircle className="h-3 w-3" /> Ditolak
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Menunggu
                          </span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 dark:text-gray-300 max-w-xs">
                      {req.adminNote || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => {
                              setSelectedRequest(req);
                              setReviewAction('APPROVE');
                            }}
                          >
                            Setujui
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedRequest(req);
                              setReviewAction('REJECT');
                            }}
                          >
                            Tolak
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">Selesai</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog
        open={Boolean(selectedRequest && reviewAction)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRequest(null);
            setReviewAction(null);
            setAdminNote('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white">
              {reviewAction === 'APPROVE'
                ? 'Setujui Pengajuan Course'
                : 'Tolak Pengajuan Course'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {reviewAction === 'APPROVE'
                ? `Anda akan menyetujui pengajuan "${selectedRequest?.title}". Course akan otomatis aktif dan didaftarkan atas nama guru terkait.`
                : `Anda akan menolak pengajuan "${selectedRequest?.title}".`}
            </p>

            <div className="space-y-2">
              <Label htmlFor="adminNote">
                Catatan / Alasan {reviewAction === 'APPROVE' ? '(Opsional)' : '(Wajib)'}
              </Label>
              <Input
                id="adminNote"
                placeholder={
                  reviewAction === 'APPROVE'
                    ? 'misal: Silakan lengkapi materi modul dan penugasan'
                    : 'misal: Kurikulum mata pelajaran ini sudah diampu guru lain'
                }
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedRequest(null);
                setReviewAction(null);
              }}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={handleReview}
              className={
                reviewAction === 'APPROVE'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }
            >
              {loading
                ? 'Memproses...'
                : reviewAction === 'APPROVE'
                ? 'Konfirmasi Setujui'
                : 'Konfirmasi Tolak'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
