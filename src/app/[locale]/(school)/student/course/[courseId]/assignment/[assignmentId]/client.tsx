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
} from 'lucide-react';
import { submitAssignment } from '@/lib/actions/assignment';
import { Link } from '@/i18n/navigation';

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
      alert(err.message || 'Gagal mengumpulkan tugas');
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

                <div className="flex items-center justify-between p-3 bg-white rounded border">
                  <div className="flex items-center gap-2">
                    <FileDown className="h-5 w-5 text-emerald-600" />
                    <span className="text-sm font-medium text-gray-800">
                      {submission.fileName}
                    </span>
                  </div>
                  <a
                    href={submission.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <FileDown className="h-3.5 w-3.5" /> Unduh Berkas
                  </a>
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
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                  className="bg-white"
                />
                <p className="text-xs text-gray-500">
                  Maksimal ukuran berkas {assignment.maxFileSize || 25}MB. Format: {assignment.allowedTypes || 'pdf, docx, zip'}.
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
    </div>
  );
}
