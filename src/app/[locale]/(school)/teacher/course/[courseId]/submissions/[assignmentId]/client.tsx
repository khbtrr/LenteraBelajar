'use client';

import { useState } from 'react';
import Link from 'next/link';
import { gradeAssignmentSubmission } from '@/lib/actions/grade';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Download, FileText, CheckCircle, Clock, AlertCircle, Award } from 'lucide-react';

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
    studentName: string;
    score: number;
    teacherNote: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const submittedCount = students.filter((s) => s.submission !== null).length;
  const gradedCount = students.filter((s) => s.submission?.score !== null && s.submission?.score !== undefined).length;

  const handleOpenGradeModal = (item: (typeof students)[0]) => {
    if (!item.submission) return;
    setSelectedSubmission({
      id: item.submission.id,
      studentName: item.student.name,
      score: item.submission.score ?? data.assignment.maxScore,
      teacherNote: item.submission.teacherNote ?? '',
    });
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
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan nilai');
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
                          <a
                            href={sub.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="truncate max-w-[150px]" title={sub.fileName}>
                              {sub.fileName}
                            </span>
                            <Download className="h-3 w-3 text-gray-400" />
                          </a>
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

      {/* Grade Dialog */}
      <Dialog open={selectedSubmission !== null} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedSubmission && (
            <form onSubmit={handleSaveGrade}>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-[#002446]">
                  Penilaian: {selectedSubmission.studentName}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="score">
                    Nilai Angka (Maksimal: {data.assignment.maxScore})
                  </Label>
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
                    className="font-bold text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="note">Catatan Evaluasi / Feedback Guru (Opsional)</Label>
                  <Textarea
                    id="note"
                    placeholder="Tuliskan evaluasi atau perbaikan yang perlu diperhatikan siswa..."
                    rows={4}
                    value={selectedSubmission.teacherNote}
                    onChange={(e) =>
                      setSelectedSubmission({
                        ...selectedSubmission,
                        teacherNote: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <DialogFooter className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedSubmission(null)}
                  disabled={loading}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white font-medium"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Nilai'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
