'use client';

import { useState } from 'react';
import Link from 'next/link';
import { gradeQuizEssayAnswer } from '@/lib/actions/grade';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, CheckCircle2, Clock, HelpCircle, Award, User, Shield } from 'lucide-react';
import { useDialog } from '@/context/DialogContext';

interface QuizAttemptsClientProps {
  data: {
    quiz: {
      id: string;
      title: string;
      courseId: string;
      courseTitle: string;
      passingGrade?: number | null;
      maxAttempts?: number | null;
    };
    questions: Array<{
      id: string;
      type: string;
      text: string;
      points: number;
    }>;
    attempts: Array<{
      id: string;
      score: number | null;
      isGraded: boolean;
      submittedAt: Date | null;
      user: {
        id: string;
        name: string;
        email: string;
        nis: string | null;
      };
      answers: Array<{
        id: string;
        questionId: string;
        answer: string | null;
        score: number | null;
        teacherNote: string | null;
        question: {
          id: string;
          type: string;
          text: string;
          points: number;
        };
      }>;
    }>;
  };
}

export function TeacherQuizAttemptsClient({ data }: QuizAttemptsClientProps) {
  const { showAlert } = useDialog();
  const [attempts, setAttempts] = useState(data.attempts);
  const [selectedAttempt, setSelectedAttempt] = useState<(typeof attempts)[0] | null>(null);
  const [gradingAnswer, setGradingAnswer] = useState<{
    answerId: string;
    questionText: string;
    studentAnswer: string;
    maxPoints: number;
    score: number;
    note: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const hasEssay = data.questions.some((q) => q.type === 'ESSAY');

  const handleOpenEssayGrade = (ans: (typeof attempts)[0]['answers'][0]) => {
    setGradingAnswer({
      answerId: ans.id,
      questionText: ans.question.text,
      studentAnswer: ans.answer || '(Tidak menjawab)',
      maxPoints: ans.question.points,
      score: ans.score ?? ans.question.points,
      note: ans.teacherNote ?? '',
    });
  };

  const handleSaveEssayGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingAnswer) return;

    setLoading(true);
    try {
      await gradeQuizEssayAnswer(gradingAnswer.answerId, {
        score: Number(gradingAnswer.score),
        teacherNote: gradingAnswer.note,
      });

      // Update local state
      setAttempts((prev) =>
        prev.map((att) => ({
          ...att,
          answers: att.answers.map((a) =>
            a.id === gradingAnswer.answerId
              ? { ...a, score: Number(gradingAnswer.score), teacherNote: gradingAnswer.note }
              : a
          ),
        }))
      );

      if (selectedAttempt) {
        setSelectedAttempt((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            answers: prev.answers.map((a) =>
              a.id === gradingAnswer.answerId
                ? { ...a, score: Number(gradingAnswer.score), teacherNote: gradingAnswer.note }
                : a
            ),
          };
        });
      }

      setGradingAnswer(null);
      await showAlert('Nilai essay berhasil disimpan!', { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal menyimpan nilai essay', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href={`/teacher/course/${data.quiz.courseId}/modules`}>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-[#002446]">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-[#002446]">Riwayat Kuis: {data.quiz.title}</h1>
          </div>
          <p className="text-sm text-gray-500 pl-10">
            {data.quiz.courseTitle} • {data.questions.length} Soal{' '}
            {data.quiz.passingGrade !== undefined && data.quiz.passingGrade !== null && (
              <span className="text-blue-700 font-semibold">• KKM: {data.quiz.passingGrade}{' '}</span>
            )}
            {data.quiz.maxAttempts !== undefined && data.quiz.maxAttempts !== null && (
              <span className="text-purple-700 font-semibold">• Maks: {data.quiz.maxAttempts}x Percobaan{' '}</span>
            )}
            {hasEssay && <span className="text-amber-700 font-semibold">(Mengandung Soal Essay)</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/teacher/course/${data.quiz.courseId}/quiz-attempts/${data.quiz.id}/proctor`}>
            <Button className="bg-[#002446] hover:bg-[#001b33] text-white flex items-center gap-1.5 font-bold">
              <Shield className="h-4 w-4 text-emerald-400" />
              Live Proctoring
            </Button>
          </Link>
          <Link href={`/teacher/course/${data.quiz.courseId}/gradebook`}>
            <Button variant="outline" className="border-[#002446] text-[#002446] hover:bg-gray-100">
              Lihat Buku Nilai
            </Button>
          </Link>
        </div>
      </div>

      {/* Attempts Table */}
      <Card className="bg-white shadow-sm border">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-lg font-bold text-[#002446]">
            Daftar Siswa yang Mengerjakan ({attempts.length})
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4 text-center">NIS</th>
                  <th className="py-3 px-4">Waktu Kumpul</th>
                  <th className="py-3 px-4 text-center">Nilai Akhir</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {attempts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      Belum ada siswa yang mengumpulkan kuis ini
                    </td>
                  </tr>
                ) : (
                  attempts.map((att, idx) => (
                    <tr key={att.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-center text-gray-500 font-medium">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{att.user.name}</div>
                        <div className="text-xs text-gray-400">{att.user.email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs text-gray-600 font-mono">
                        {att.user.nis || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-600">
                        {att.submittedAt ? (
                          <div>
                            <div>{new Date(att.submittedAt).toLocaleDateString('id-ID')}</div>
                            <div className="text-[11px] text-gray-400">
                              {new Date(att.submittedAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {att.score !== null ? (
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                              att.score >= 75
                                ? 'bg-emerald-100 text-emerald-800'
                                : att.score >= 60
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {att.score} / 100
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {att.isGraded ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Selesai Dinilai
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                              <Clock className="h-3.5 w-3.5" /> Menunggu Koreksi Essay
                            </span>
                          )}
                          {att.isGraded && att.score !== null && data.quiz.passingGrade !== undefined && data.quiz.passingGrade !== null && (
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                att.score >= data.quiz.passingGrade
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {att.score >= data.quiz.passingGrade ? '✓ Lulus' : '✗ Tidak Lulus'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => setSelectedAttempt(att)}
                          className="bg-[#002446] hover:bg-[#002446]/90 text-white text-xs h-8"
                        >
                          Periksa Jawaban
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Attempt Review Dialog */}
      <Dialog open={selectedAttempt !== null} onOpenChange={(open) => !open && setSelectedAttempt(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedAttempt && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-bold text-[#002446]">
                    Jawaban: {selectedAttempt.user.name}
                  </DialogTitle>
                  <span className="text-lg font-bold text-[#FF8928] bg-amber-50 px-3 py-1 rounded-md">
                    Skor: {selectedAttempt.score !== null ? selectedAttempt.score : 0} / 100
                  </span>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {selectedAttempt.answers.map((ans, idx) => (
                  <Card key={ans.id} className="border shadow-none bg-gray-50/50">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b bg-white">
                      <span className="font-semibold text-sm text-gray-800">
                        Soal {idx + 1} ({ans.question.type === 'MULTIPLE_CHOICE' ? 'Pilihan Ganda' : 'Essay'})
                      </span>
                      <span className="text-xs font-bold text-gray-600">
                        Nilai: {ans.score !== null ? ans.score : '-'} / {ans.question.points}
                      </span>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="text-sm font-medium text-gray-900">{ans.question.text}</div>
                      <div className="bg-white p-3 rounded-md border text-sm text-gray-700">
                        <span className="text-xs text-gray-400 block mb-1">Jawaban Siswa:</span>
                        <p className="whitespace-pre-wrap">{ans.answer || '(Tidak dijawab)'}</p>
                      </div>

                      {ans.teacherNote && (
                        <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded border border-amber-200">
                          <strong>Catatan Guru:</strong> {ans.teacherNote}
                        </div>
                      )}

                      {ans.question.type === 'ESSAY' && (
                        <div className="pt-2 flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => handleOpenEssayGrade(ans)}
                            className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white text-xs"
                          >
                            {ans.score !== null ? 'Ubah Nilai Essay' : 'Beri Nilai Essay'}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Essay Grade Modal */}
      <Dialog open={gradingAnswer !== null} onOpenChange={(open) => !open && setGradingAnswer(null)}>
        <DialogContent className="sm:max-w-md">
          {gradingAnswer && (
            <form onSubmit={handleSaveEssayGrade}>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-[#002446]">Koreksi Soal Essay</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div className="space-y-1">
                  <span className="text-xs text-gray-500">Soal:</span>
                  <p className="text-sm font-medium text-gray-900">{gradingAnswer.questionText}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-gray-500">Jawaban Siswa:</span>
                  <div className="bg-gray-50 p-2.5 rounded border text-sm text-gray-800 max-h-32 overflow-y-auto">
                    {gradingAnswer.studentAnswer}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="essayScore">
                    Nilai Butir Soal (Maks: {gradingAnswer.maxPoints})
                  </Label>
                  <Input
                    id="essayScore"
                    type="number"
                    min={0}
                    max={gradingAnswer.maxPoints}
                    value={gradingAnswer.score}
                    onChange={(e) =>
                      setGradingAnswer({ ...gradingAnswer, score: Number(e.target.value) })
                    }
                    required
                    className="font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="essayNote">Catatan / Ulasan (Opsional)</Label>
                  <Textarea
                    id="essayNote"
                    rows={3}
                    placeholder="Feedback untuk jawaban essay ini..."
                    value={gradingAnswer.note}
                    onChange={(e) => setGradingAnswer({ ...gradingAnswer, note: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setGradingAnswer(null)} disabled={loading}>
                  Batal
                </Button>
                <Button type="submit" disabled={loading} className="bg-[#FF8928] text-white">
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
