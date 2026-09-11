'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ClipboardList,
  Calendar,
  Upload,
  FileDown,
  CheckCircle2,
  Clock,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  Paperclip,
  Eye,
  Download,
} from 'lucide-react';
import { submitAssignment } from '@/lib/actions/assignment';
import { Link } from '@/i18n/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { FilePreviewer } from '@/components/assignment/file-previewer';

export function StudentAssignmentClient({
  courseId,
  assignment,
}: {
  courseId: string;
  assignment: any;
}) {
  const existingSubmission = assignment.submissions?.[0] || null;
  const [submission, setSubmission] = useState<any>(existingSubmission);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [previewFileModal, setPreviewFileModal] = useState<{
    url: string;
    name: string;
    size?: number;
    title: string;
  } | null>(null);
  const [noticeModal, setNoticeModal] = useState<{
    title: string;
    message: string;
    type?: 'error' | 'warning' | 'info' | 'success';
  } | null>(null);

  const allowedExts = (assignment.allowedTypes || 'pdf,docx,zip,png,jpg,jpeg')
    .split(',')
    .map((e: string) => e.trim().replace(/^\./, '').toLowerCase())
    .filter(Boolean);

  const acceptAttr = allowedExts.map((ext: string) => `.${ext}`).join(',');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    if (!selected) {
      setFile(null);
      return;
    }

    const fileExt = (selected.name.split('.').pop() || '').toLowerCase();
    if (allowedExts.length > 0 && !allowedExts.includes(fileExt)) {
      setNoticeModal({
        title: 'Format Berkas Tidak Diizinkan',
        message: `Format berkas ".${fileExt}" tidak diizinkan. Tugas ini hanya menerima format berkas: ${allowedExts.join(', ').toUpperCase()}`,
        type: 'warning',
      });
      e.target.value = '';
      setFile(null);
      return;
    }

    const maxMb = assignment.maxFileSize || 25;
    if (selected.size > maxMb * 1024 * 1024) {
      setNoticeModal({
        title: 'Ukuran Berkas Terlalu Besar',
        message: `Ukuran berkas (${(selected.size / (1024 * 1024)).toFixed(1)}MB) melebihi batas maksimal yang ditentukan yaitu ${maxMb}MB.`,
        type: 'warning',
      });
      e.target.value = '';
      setFile(null);
      return;
    }

    setFile(selected);
  };

  const isDeadlinePassed =
    assignment.deadline && new Date() > new Date(assignment.deadline);

  const handleSubmitFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setSuccessMsg('');
    try {
      // 1. Upload file to server
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json();
        throw new Error(errJson.error || 'Gagal mengunggah file');
      }

      const uploadData = await uploadRes.json();

      // 2. Submit assignment record
      const res = await submitAssignment({
        assignmentId: assignment.id,
        fileUrl: uploadData.url,
        fileName: uploadData.fileName,
        fileSize: uploadData.fileSize,
      });

      setSubmission(res);
      setFile(null);
      setSuccessMsg('Tugas berhasil dikumpulkan!');
    } catch (err: any) {
      console.error(err);
      setNoticeModal({
        title: 'Gagal Mengumpulkan Tugas',
        message: err?.message || 'Terjadi kesalahan saat mengunggah berkas tugas. Silakan coba lagi.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/student/course/${courseId}/modules`}>
          <Button variant="ghost" size="sm" className="gap-1 text-gray-600">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
        </Link>
      </div>

      {/* Assignment Header Card */}
      <Card className="border border-gray-200 bg-white shadow-sm">
        <CardHeader className="p-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4" /> Penugasan Terstruktur
              </div>
              <CardTitle className="text-2xl font-bold text-[#002446]">
                {assignment.title}
              </CardTitle>
            </div>

            <Badge
              className={
                submission
                  ? 'bg-green-600 text-white'
                  : isDeadlinePassed
                  ? 'bg-red-600 text-white'
                  : 'bg-[#FF8928] text-white'
              }
            >
              {submission
                ? 'Sudah Dikumpulkan'
                : isDeadlinePassed
                ? 'Batas Waktu Berakhir'
                : 'Belum Dikumpulkan'}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-gray-600 pt-4 border-t mt-4">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-[#FF8928]" />
              <span>
                Batas Pengumpulan:{' '}
                <strong>
                  {assignment.deadline
                    ? new Date(assignment.deadline).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Tidak ada batas waktu'}
                </strong>
              </span>
            </div>

            <div>
              Nilai Maksimal: <strong>{assignment.maxScore} Poin</strong>
            </div>

            <div>
              Format Berkas Diizinkan:{' '}
              <strong className="uppercase">{assignment.allowedTypes || 'Semua'}</strong>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 pt-2 space-y-4">
          {/* Instruksi Tugas */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-gray-700">Instruksi & Petunjuk Pengerjaan:</h4>
            <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-800 leading-relaxed whitespace-pre-wrap border">
              {assignment.description || 'Tidak ada petunjuk tambahan dari guru.'}
            </div>
          </div>

          {/* Lampiran Soal / Berkas dari Guru */}
          {assignment.fileUrl && (
            <div className="p-4 bg-purple-50/70 rounded-lg border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                  <Paperclip className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                    Berkas Lampiran Soal / Panduan Guru
                  </div>
                  <div className="text-sm font-semibold text-purple-900 truncate">
                    {assignment.fileName || 'Lampiran Tugas'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPreviewFileModal({
                      url: assignment.fileUrl,
                      name: assignment.fileName || 'Lampiran Guru',
                      size: assignment.fileSize,
                      title: 'Pratinjau Berkas Lampiran Soal Guru',
                    })
                  }
                  className="h-8 text-xs border-purple-300 text-purple-700 hover:bg-purple-100 flex items-center gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" /> Pratinjau
                </Button>
                <a
                  href={assignment.fileUrl}
                  download={assignment.fileName || 'Lampiran'}
                  className="h-8 px-3 text-xs bg-purple-700 hover:bg-purple-800 text-white font-medium rounded-md flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> Unduh Berkas
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submission Status & Form */}
      <Card className="border border-gray-200 bg-white shadow-sm">
        <CardHeader className="p-6 pb-3">
          <CardTitle className="text-lg font-bold text-[#002446]">
            Status Pengumpulan Tugas
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6 pt-0 space-y-6">
          {successMsg && (
            <div className="p-4 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              {successMsg}
            </div>
          )}

          {submission ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-50/50 border border-green-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-800 font-bold text-sm">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Berkas Tugas Telah Terkirim
                  </div>
                  <span className="text-xs text-gray-500">
                    Dikumpulkan pada:{' '}
                    {new Date(submission.submittedAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white rounded border gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileDown className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {submission.fileName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPreviewFileModal({
                          url: submission.fileUrl,
                          name: submission.fileName,
                          size: submission.fileSize,
                          title: 'Pratinjau Berkas Tugas Saya',
                        })
                      }
                      className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 flex items-center gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" /> Pratinjau
                    </Button>
                    <a
                      href={submission.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 px-2 py-1"
                    >
                      <FileDown className="h-3.5 w-3.5" /> Unduh
                    </a>
                  </div>
                </div>

                {submission.score !== null ? (
                  <div className="p-4 bg-white border border-blue-200 rounded-md">
                    <div className="text-xs font-bold text-[#FF8928] uppercase">
                      Nilai dari Guru
                    </div>
                    <div className="text-2xl font-black text-[#002446] mt-1">
                      {submission.score} / {assignment.maxScore}
                    </div>
                    {submission.teacherNote && (
                      <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2.5 rounded border">
                        <strong>Catatan Guru:</strong> {submission.teacherNote}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 italic">
                    Tugas Anda sedang menunggu pemeriksaan dan penilaian dari guru pengampu.
                  </p>
                )}
              </div>
            </div>
          ) : isDeadlinePassed ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Batas waktu pengumpulan tugas ini telah berakhir. Anda tidak dapat mengunggah berkas lagi.
            </div>
          ) : null}

          {/* Form Upload Submission (shown if not deadline passed) */}
          {!isDeadlinePassed && (
            <form onSubmit={handleSubmitFile} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="subFile">
                  {submission ? 'Kirim Ulang / Ganti Berkas Tugas' : 'Pilih Berkas Tugas Anda'}
                </Label>
                <Input
                  id="subFile"
                  type="file"
                  accept={acceptAttr || undefined}
                  onChange={handleFileChange}
                  required
                  className="bg-white"
                />
                <p className="text-xs text-gray-500">
                  Maksimal ukuran berkas {assignment.maxFileSize || 25}MB. Format yang diterima:{' '}
                  <strong className="uppercase text-gray-700">{assignment.allowedTypes || 'Semua'}</strong>.
                </p>
              </div>

              <Button
                type="submit"
                disabled={!file || loading}
                className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {loading ? 'Mengunggah...' : submission ? 'Kirim Pembaruan Berkas' : 'Kumpulkan Tugas Sekarang'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal for Student */}
      <Dialog
        open={previewFileModal !== null}
        onOpenChange={(open) => !open && setPreviewFileModal(null)}
      >
        <DialogContent className="max-w-5xl w-[95vw] h-[88vh] max-h-[88vh] flex flex-col p-0 overflow-hidden bg-slate-900 border-slate-800">
          {previewFileModal && (
            <div className="flex flex-col h-full">
              <div className="px-5 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-white shrink-0">
                <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Eye className="h-4 w-4 text-emerald-400" /> {previewFileModal.title}
                </DialogTitle>
              </div>
              <div className="flex-1 p-2 sm:p-4 overflow-hidden">
                <FilePreviewer
                  fileUrl={previewFileModal.url}
                  fileName={previewFileModal.name}
                  fileSize={previewFileModal.size}
                  className="h-full"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Notifikasi / Alert Dialog */}
      <Dialog open={Boolean(noticeModal)} onOpenChange={(open) => !open && setNoticeModal(null)}>
        <DialogContent className="max-w-md p-6 bg-white border border-gray-200 text-center">
          <DialogHeader className="space-y-3 text-center sm:text-center">
            <div
              className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${
                noticeModal?.type === 'warning'
                  ? 'bg-amber-100 text-amber-600'
                  : noticeModal?.type === 'success'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-red-100 text-red-600'
              }`}
            >
              {noticeModal?.type === 'warning' ? (
                <AlertTriangle className="w-6 h-6" />
              ) : noticeModal?.type === 'success' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6" />
              )}
            </div>
            <DialogTitle className="text-lg font-bold text-[#002446]">
              {noticeModal?.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              {noticeModal?.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              onClick={() => setNoticeModal(null)}
              className="w-full bg-[#002446] hover:bg-[#002446]/90 text-white font-bold"
            >
              Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
