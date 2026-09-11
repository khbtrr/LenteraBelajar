'use client';

import { useState } from 'react';
import Link from 'next/link';
import { gradeAssignmentSubmission } from '@/lib/actions/grade';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Download, FileText, CheckCircle, CheckCircle2, Clock, AlertCircle, AlertTriangle, Award, Eye, Calendar, User as UserIcon, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { FilePreviewer } from '@/components/assignment/file-previewer';

interface SubmissionsClientProps {
  data: {
    assignment: {
      id: string;
      title: string;
      description: string | null;
      deadline: Date | null;
      maxScore: number;
      courseId: string;
      courseTitle: string;
    };
    enrolledStudents: Array<{
      student: {
        id: string;
        name: string;
        email: string;
        nis: string | null;
      };
      submission: {
        id: string;
        fileName: string;
        fileUrl: string;
        fileSize: number;
        submittedAt: Date;
        score: number | null;
        teacherNote: string | null;
        gradedAt: Date | null;
      } | null;
    }>;
  };
}

export function TeacherSubmissionsClient({ data }: SubmissionsClientProps) {
  const [students, setStudents] = useState(data.enrolledStudents);
  const [selectedSubmission, setSelectedSubmission] = useState<{
    id: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    studentNis: string | null;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    submittedAt: Date;
    isLate: boolean;
    score: number;
    teacherNote: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [noticeModal, setNoticeModal] = useState<{
    title: string;
    message: string;
    type?: 'error' | 'warning' | 'info' | 'success';
  } | null>(null);

  const submittedCount = students.filter((s) => s.submission !== null).length;
  const gradedCount = students.filter((s) => s.submission?.score !== null && s.submission?.score !== undefined).length;

  const submittedStudents = students.filter((s) => s.submission !== null);
  const currentSubmittedIndex = submittedStudents.findIndex(
    (s) => s.student.id === selectedSubmission?.studentId
  );
  const hasPrevStudent = currentSubmittedIndex > 0;
  const hasNextStudent =
    currentSubmittedIndex >= 0 && currentSubmittedIndex < submittedStudents.length - 1;

  const handleOpenGradeModal = (item: (typeof students)[0]) => {
    if (!item.submission) return;
    const isLate =
      data.assignment.deadline && item.submission
        ? new Date(item.submission.submittedAt) > new Date(data.assignment.deadline)
        : false;

    setSelectedSubmission({
      id: item.submission.id,
      studentId: item.student.id,
      studentName: item.student.name,
      studentEmail: item.student.email,
      studentNis: item.student.nis,
      fileUrl: item.submission.fileUrl,
      fileName: item.submission.fileName,
      fileSize: item.submission.fileSize,
      submittedAt: item.submission.submittedAt,
      isLate: Boolean(isLate),
      score: item.submission.score ?? data.assignment.maxScore,
      teacherNote: item.submission.teacherNote ?? '',
    });
  };

  const handleNavigateStudent = (direction: 'prev' | 'next') => {
    if (currentSubmittedIndex === -1) return;
    const targetIndex = direction === 'prev' ? currentSubmittedIndex - 1 : currentSubmittedIndex + 1;
    if (targetIndex >= 0 && targetIndex < submittedStudents.length) {
      handleOpenGradeModal(submittedStudents[targetIndex]);
    }
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission) return;

    setLoading(true);
    try {
      await gradeAssignmentSubmission(selectedSubmission.id, {
        score: Number(selectedSubmission.score),
        teacherNote: selectedSubmission.teacherNote,
      });

      setStudents((prev) =>
        prev.map((item) => {
          if (item.submission?.id === selectedSubmission.id) {
            return {
              ...item,
              submission: {
                ...item.submission,
                score: Number(selectedSubmission.score),
                teacherNote: selectedSubmission.teacherNote,
                gradedAt: new Date(),
              },
            };
          }
          return item;
        })
      );

      setSelectedSubmission(null);
    } catch (err: any) {
      console.error(err);
      setNoticeModal({
        title: 'Gagal Menyimpan Nilai',
        message: err?.message || 'Terjadi kesalahan saat menyimpan nilai. Silakan coba lagi.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndNext = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedSubmission) return;

    setLoading(true);
    try {
      await gradeAssignmentSubmission(selectedSubmission.id, {
        score: Number(selectedSubmission.score),
        teacherNote: selectedSubmission.teacherNote,
      });

      const updatedStudents = students.map((item) => {
        if (item.submission?.id === selectedSubmission.id) {
          return {
            ...item,
            submission: {
              ...item.submission,
              score: Number(selectedSubmission.score),
              teacherNote: selectedSubmission.teacherNote,
              gradedAt: new Date(),
            },
          };
        }
        return item;
      });
      setStudents(updatedStudents);

      if (hasNextStudent) {
        const nextStudent = submittedStudents[currentSubmittedIndex + 1];
        const isLate =
          data.assignment.deadline && nextStudent.submission
            ? new Date(nextStudent.submission.submittedAt) > new Date(data.assignment.deadline)
            : false;

        setSelectedSubmission({
          id: nextStudent.submission!.id,
          studentId: nextStudent.student.id,
          studentName: nextStudent.student.name,
          studentEmail: nextStudent.student.email,
          studentNis: nextStudent.student.nis,
          fileUrl: nextStudent.submission!.fileUrl,
          fileName: nextStudent.submission!.fileName,
          fileSize: nextStudent.submission!.fileSize,
          submittedAt: nextStudent.submission!.submittedAt,
          isLate: Boolean(isLate),
          score: nextStudent.submission!.score ?? data.assignment.maxScore,
          teacherNote: nextStudent.submission!.teacherNote ?? '',
        });
      } else {
        setSelectedSubmission(null);
      }
    } catch (err: any) {
      console.error(err);
      setNoticeModal({
        title: 'Gagal Menyimpan Nilai',
        message: err?.message || 'Terjadi kesalahan saat menyimpan nilai. Silakan coba lagi.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href={`/teacher/course/${data.assignment.courseId}/modules`}>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-[#002446]">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-[#002446]">Penilaian Tugas: {data.assignment.title}</h1>
          </div>
          <p className="text-sm text-gray-500 pl-10">
            {data.assignment.courseTitle} • Skor Maksimal: {data.assignment.maxScore}
          </p>
        </div>

        <Link href={`/teacher/course/${data.assignment.courseId}/gradebook`}>
          <Button variant="outline" className="border-[#002446] text-[#002446] hover:bg-gray-100">
            Lihat Buku Nilai
          </Button>
        </Link>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Siswa
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-[#002446]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#002446]">{students.length}</div>
            <p className="text-xs text-gray-500 mt-1">Siswa terdaftar di course</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Sudah Mengumpulkan
            </CardTitle>
            <Clock className="h-4 w-4 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FF8928]">{submittedCount}</div>
            <p className="text-xs text-gray-500 mt-1">
              {students.length - submittedCount} belum mengumpulkan
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Sudah Dinilai
            </CardTitle>
            <Award className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{gradedCount}</div>
            <p className="text-xs text-gray-500 mt-1">{submittedCount - gradedCount} menunggu penilaian</p>
          </CardContent>
        </Card>
      </div>

      {/* Submissions Table */}
      <Card className="bg-white shadow-sm border">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-lg font-bold text-[#002446]">Daftar Pengumpulan Siswa</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4 text-center">NIS</th>
                  <th className="py-3 px-4">Berkas Tugas</th>
                  <th className="py-3 px-4">Waktu Kumpul</th>
                  <th className="py-3 px-4 text-center">Nilai</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {students.map((item, idx) => {
                  const sub = item.submission;
                  const isLate =
                    data.assignment.deadline && sub
                      ? new Date(sub.submittedAt) > new Date(data.assignment.deadline)
                      : false;

                  return (
                    <tr key={item.student.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-center text-gray-500 font-medium">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{item.student.name}</div>
                        <div className="text-xs text-gray-400">{item.student.email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs text-gray-600 font-mono">
                        {item.student.nis || '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        {sub ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenGradeModal(item)}
                              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium text-left group"
                              title="Klik untuk pratinjau dan beri nilai"
                            >
                              <FileText className="h-4 w-4 shrink-0 text-blue-500 group-hover:text-blue-700" />
                              <span className="truncate max-w-[130px] font-medium" title={sub.fileName}>
                                {sub.fileName}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenGradeModal(item)}
                              className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 hover:bg-blue-100 px-1.5 py-0.5 rounded transition-colors shrink-0"
                              title="Buka pratinjau berkas"
                            >
                              <Eye className="h-3 w-3" /> Pratinjau
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            <AlertCircle className="h-3.5 w-3.5" /> Belum Mengumpulkan
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-600">
                        {sub ? (
                          <div>
                            <div>{new Date(sub.submittedAt).toLocaleDateString('id-ID')}</div>
                            <div className="text-[11px] text-gray-400">
                              {new Date(sub.submittedAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                            {isLate && (
                              <span className="text-[10px] text-red-600 font-semibold">Terlambat</span>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {sub?.score !== null && sub?.score !== undefined ? (
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                              sub.score >= 75
                                ? 'bg-emerald-100 text-emerald-800'
                                : sub.score >= 60
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {sub.score} / {data.assignment.maxScore}
                          </span>
                        ) : sub ? (
                          <span className="text-xs text-amber-600 font-medium">Belum Dinilai</span>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {sub ? (
                          <Button
                            size="sm"
                            onClick={() => handleOpenGradeModal(item)}
                            className="bg-[#002446] hover:bg-[#002446]/90 text-white text-xs h-8"
                          >
                            {sub.score !== null ? 'Ubah Nilai' : 'Beri Nilai'}
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" disabled className="text-xs h-8 text-gray-400">
                            -
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Integrated Preview & Grade Dialog */}
      <Dialog
        open={selectedSubmission !== null}
        onOpenChange={(open) => !open && setSelectedSubmission(null)}
      >
        <DialogContent className="max-w-6xl w-[96vw] h-[92vh] max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white gap-0">
          {selectedSubmission && (
            <>
              {/* Modal Top Header */}
              <div className="px-4 sm:px-6 py-3 bg-[#002446] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 border-b">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-bold text-white uppercase shrink-0">
                    {selectedSubmission.studentName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-white truncate">
                        {selectedSubmission.studentName}
                      </h2>
                      {selectedSubmission.studentNis && (
                        <span className="text-xs font-normal text-slate-300 font-mono">
                          ({selectedSubmission.studentNis})
                        </span>
                      )}
                      {selectedSubmission.isLate ? (
                        <span className="text-[10px] bg-red-500/80 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Terlambat
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-500/80 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Tepat Waktu
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 truncate">
                      Tugas: {data.assignment.title} • Dikumpulkan: {new Date(selectedSubmission.submittedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* Navigation & Selector across students */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {submittedStudents.length > 1 && (
                    <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-lg border border-slate-700 text-xs">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!hasPrevStudent || loading}
                        onClick={() => handleNavigateStudent('prev')}
                        className="h-7 w-7 p-0 text-slate-200 hover:text-white hover:bg-slate-700 disabled:opacity-30"
                        title="Siswa Sebelumnya"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      {/* Dropdown to jump directly to any student */}
                      <select
                        value={selectedSubmission.studentId}
                        onChange={(e) => {
                          const target = submittedStudents.find(
                            (s) => s.student.id === e.target.value
                          );
                          if (target) handleOpenGradeModal(target);
                        }}
                        className="bg-slate-900 text-white text-xs border border-slate-700 rounded px-2 py-1 max-w-[160px] sm:max-w-[200px] truncate focus:outline-none focus:ring-1 focus:ring-[#FF8928]"
                        title="Pilih Siswa"
                      >
                        {submittedStudents.map((item, idx) => (
                          <option key={item.student.id} value={item.student.id}>
                            {idx + 1}. {item.student.name} {item.submission?.score !== null ? `(${item.submission?.score} poin)` : '(Belum dinilai)'}
                          </option>
                        ))}
                      </select>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!hasNextStudent || loading}
                        onClick={() => handleNavigateStudent('next')}
                        className="h-7 w-7 p-0 text-slate-200 hover:text-white hover:bg-slate-700 disabled:opacity-30"
                        title="Siswa Berikutnya"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  <span className="text-xs text-slate-300 hidden md:inline ml-1">
                    Skor Maks: <strong>{data.assignment.maxScore}</strong>
                  </span>
                </div>
              </div>

              {/* Modal Body: Split 2 Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
                {/* Left Column: File Previewer */}
                <div className="lg:col-span-7 xl:col-span-8 bg-slate-950 p-2 sm:p-4 flex flex-col overflow-hidden h-[42vh] lg:h-full">
                  <FilePreviewer
                    fileUrl={selectedSubmission.fileUrl}
                    fileName={selectedSubmission.fileName}
                    fileSize={selectedSubmission.fileSize}
                    className="h-full"
                  />
                </div>

                {/* Right Column: Grading & Feedback Form */}
                <div className="lg:col-span-5 xl:col-span-4 bg-white flex flex-col justify-between overflow-y-auto border-t lg:border-t-0 lg:border-l border-gray-200">
                  <form onSubmit={handleSaveGrade} className="p-5 sm:p-6 flex flex-col justify-between h-full space-y-4">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                          Form Penilaian Guru
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Periksa berkas di sisi kiri, lalu masukkan nilai dan catatan evaluasi untuk siswa.
                        </p>
                      </div>

                      {/* Quick Score helper buttons */}
                      <div className="space-y-1.5 pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="score" className="text-xs font-bold text-gray-700">
                            Nilai Angka (Maks: {data.assignment.maxScore})
                          </Label>
                          <div className="flex items-center gap-1">
                            {[100, 90, 85, 75].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() =>
                                  setSelectedSubmission({
                                    ...selectedSubmission,
                                    score: Math.min(preset, data.assignment.maxScore),
                                  })
                                }
                                className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>

                        <Input
                          id="score"
                          type="number"
                          min={0}
                          max={data.assignment.maxScore}
                          value={selectedSubmission.score}
                          onChange={(e) =>
                            setSelectedSubmission({
                              ...selectedSubmission,
                              score: Number(e.target.value),
                            })
                          }
                          required
                          className="font-bold text-xl h-11 text-[#002446]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="note" className="text-xs font-bold text-gray-700">
                          Catatan Evaluasi / Umpan Balik Guru (Opsional)
                        </Label>
                        <Textarea
                          id="note"
                          placeholder="Tuliskan catatan perbaikan, apresiasi, atau poin evaluasi terhadap tugas siswa ini..."
                          rows={6}
                          value={selectedSubmission.teacherNote}
                          onChange={(e) =>
                            setSelectedSubmission({
                              ...selectedSubmission,
                              teacherNote: e.target.value,
                            })
                          }
                          className="text-xs resize-none"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSelectedSubmission(null)}
                        disabled={loading}
                        className="text-xs"
                      >
                        Tutup
                      </Button>

                      <div className="flex items-center gap-2">
                        <Button
                          type="submit"
                          disabled={loading}
                          className="bg-[#002446] hover:bg-[#002446]/90 text-white font-medium text-xs shadow-sm"
                        >
                          {loading ? 'Menyimpan...' : 'Simpan Nilai'}
                        </Button>

                        {hasNextStudent ? (
                          <Button
                            type="button"
                            disabled={loading}
                            onClick={handleSaveAndNext}
                            className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
                          >
                            <span>Simpan & Lanjut</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            disabled={loading}
                            onClick={handleSaveAndNext}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
                          >
                            <span>Simpan & Selesai</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </>
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
