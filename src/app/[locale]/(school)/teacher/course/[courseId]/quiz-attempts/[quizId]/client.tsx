'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { gradeQuizEssayAnswer } from '@/lib/actions/grade';
import { ItemAnalysisReport } from '@/lib/actions/item-analysis';
import { RemedialEligibleData, generateRemedialQuiz } from '@/lib/actions/remedial';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  HelpCircle,
  Award,
  User,
  Shield,
  BarChart3,
  Sparkles,
  FileText,
  AlertTriangle,
  TrendingUp,
  Percent,
  Check,
  CheckSquare,
  Square,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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
      duration?: number | null;
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
  analysisData: ItemAnalysisReport | null;
  remedialData: RemedialEligibleData | null;
}

export function TeacherQuizAttemptsClient({
  data,
  analysisData,
  remedialData,
}: QuizAttemptsClientProps) {
  const router = useRouter();
  const { showAlert } = useDialog();

  const [activeTab, setActiveTab] = useState<'attempts' | 'analysis' | 'remedial'>('attempts');
  const [attempts, setAttempts] = useState(data.attempts);
  const [selectedAttempt, setSelectedAttempt] = useState<(typeof attempts)[0] | null>(null);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const [gradingAnswer, setGradingAnswer] = useState<{
    answerId: string;
    questionText: string;
    studentAnswer: string;
    maxPoints: number;
    score: number;
    note: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Remedial Generator Modal State
  const [isRemedialModalOpen, setIsRemedialModalOpen] = useState(false);
  const [remedialTitle, setRemedialTitle] = useState(`Remedial - ${data.quiz.title}`);
  const [remedialDuration, setRemedialDuration] = useState<number>(data.quiz.duration || 30);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    remedialData?.remedialStudents.map((s) => s.userId) || []
  );
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(
    remedialData?.mostFailedQuestions.map((q) => q.questionId) || data.questions.map((q) => q.id)
  );
  const [isGeneratingRemedial, setIsGeneratingRemedial] = useState(false);

  const hasEssay = data.questions.some((q) => q.type === 'ESSAY');
  const passingGrade = data.quiz.passingGrade ?? 75;

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

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleToggleAllStudents = () => {
    if (!remedialData) return;
    if (selectedStudentIds.length === remedialData.remedialStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(remedialData.remedialStudents.map((s) => s.userId));
    }
  };

  const handleToggleQuestion = (questionId: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(questionId) ? prev.filter((id) => id !== questionId) : [...prev, questionId]
    );
  };

  const handleSelectFailedQuestions = () => {
    if (!remedialData) return;
    setSelectedQuestionIds(remedialData.mostFailedQuestions.map((q) => q.questionId));
  };

  const handleSelectAllQuestions = () => {
    if (selectedQuestionIds.length === data.questions.length) {
      setSelectedQuestionIds([]);
    } else {
      setSelectedQuestionIds(data.questions.map((q) => q.id));
    }
  };

  const handleCreateRemedialQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) {
      await showAlert('Pilih minimal satu siswa target remedial.', { type: 'warning' });
      return;
    }
    if (selectedQuestionIds.length === 0) {
      await showAlert('Pilih minimal satu butir soal untuk kuis remedial.', { type: 'warning' });
      return;
    }

    setIsGeneratingRemedial(true);
    try {
      await generateRemedialQuiz({
        parentQuizId: data.quiz.id,
        title: remedialTitle,
        durationMinutes: remedialDuration,
        selectedQuestionIds,
        targetStudentIds: selectedStudentIds,
        passingGrade: passingGrade,
      });

      setIsRemedialModalOpen(false);
      await showAlert('Kuis remedial berhasil dibuat dan diterbitkan!', { type: 'success' });
      router.refresh();
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal membuat kuis remedial', { type: 'error' });
    } finally {
      setIsGeneratingRemedial(false);
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
            <h1 className="text-2xl font-bold text-[#002446]">Kuis: {data.quiz.title}</h1>
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

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('attempts')}
          className={`flex items-center gap-2 py-3.5 px-4 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'attempts'
              ? 'border-[#002446] text-[#002446]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Hasil & Koreksi</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 font-semibold">
            {attempts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analysis')}
          className={`flex items-center gap-2 py-3.5 px-4 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'analysis'
              ? 'border-[#002446] text-[#002446]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <BarChart3 className="h-4 w-4 text-blue-600" />
          <span>Analisis Butir Soal</span>
          {analysisData && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 font-semibold">
              {analysisData.questions.length} Butir
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('remedial')}
          className={`flex items-center gap-2 py-3.5 px-4 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'remedial'
              ? 'border-[#FF8928] text-[#002446]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Sparkles className="h-4 w-4 text-[#FF8928]" />
          <span>Program Remedial</span>
          {remedialData && remedialData.remedialStudents.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-900 font-semibold">
              {remedialData.remedialStudents.length} Siswa
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: HASIL & KOREKSI (ATTEMPTS) */}
      {activeTab === 'attempts' && (
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
                                att.score >= passingGrade
                                  ? 'bg-emerald-100 text-emerald-800'
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
                                <Clock className="h-3.5 w-3.5" /> Perlu Penilaian
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedAttempt(att)}
                            className="text-xs border-[#002446]/30 text-[#002446] hover:bg-[#002446] hover:text-white"
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
      )}

      {/* TAB 2: ANALISIS BUTIR SOAL */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          {!analysisData || analysisData.totalParticipants === 0 ? (
            <Card className="p-8 text-center text-gray-500 bg-white border">
              <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <div className="text-lg font-bold text-[#002446]">Belum Ada Data yang Cukup</div>
              <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                Analisis butir soal (Tingkat Kesukaran, Daya Pembeda, dan Pola Pengecoh) membutuhkan minimal pengerjaan dari siswa yang telah dinilai.
              </p>
            </Card>
          ) : (
            <>
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border shadow-xs bg-linear-to-br from-blue-50/50 to-white">
                  <CardContent className="p-4 space-y-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Peserta</div>
                    <div className="text-2xl font-black text-[#002446]">
                      {analysisData.totalParticipants} <span className="text-xs font-normal text-gray-500">siswa</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border shadow-xs bg-linear-to-br from-emerald-50/50 to-white">
                  <CardContent className="p-4 space-y-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rata-Rata Nilai</div>
                    <div className="text-2xl font-black text-emerald-700">
                      {analysisData.averageScore} <span className="text-xs font-normal text-gray-500">/ 100</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border shadow-xs bg-linear-to-br from-indigo-50/50 to-white">
                  <CardContent className="p-4 space-y-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rentang Skor</div>
                    <div className="text-2xl font-black text-[#002446]">
                      {analysisData.lowestScore} - {analysisData.highestScore}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border shadow-xs bg-linear-to-br from-amber-50/50 to-white">
                  <CardContent className="p-4 space-y-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Kelulusan KKM ({passingGrade})</div>
                    <div className="text-2xl font-black text-[#FF8928]">
                      {analysisData.passPercentage}%{' '}
                      <span className="text-xs font-normal text-gray-500">
                        ({analysisData.passedCount}/{analysisData.totalParticipants})
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Legend & Theoretical Reference */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-gray-50 border p-4 rounded-xl">
                <div>
                  <span className="font-bold text-[#002446] block mb-1">Pedoman Tingkat Kesukaran (P):</span>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-emerald-100 text-emerald-800 border-none">Mudah (P &gt; 0.70)</Badge>
                    <Badge className="bg-blue-100 text-blue-800 border-none">Sedang (0.30 ≤ P ≤ 0.70)</Badge>
                    <Badge className="bg-rose-100 text-rose-800 border-none">Sukar (P &lt; 0.30)</Badge>
                  </div>
                </div>
                <div>
                  <span className="font-bold text-[#002446] block mb-1">Pedoman Daya Pembeda (D):</span>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-emerald-100 text-emerald-800 border-none">Sangat Baik (D ≥ 0.40)</Badge>
                    <Badge className="bg-blue-100 text-blue-800 border-none">Baik (0.30 ≤ D &lt; 0.40)</Badge>
                    <Badge className="bg-amber-100 text-amber-800 border-none">Cukup (0.20 ≤ D &lt; 0.30)</Badge>
                    <Badge className="bg-rose-100 text-rose-800 border-none">Jelek / Revisi (D &lt; 0.20)</Badge>
                  </div>
                </div>
              </div>

              {/* Questions Analysis Table */}
              <Card className="bg-white shadow-sm border overflow-hidden">
                <CardHeader className="pb-3 border-b bg-gray-50/50">
                  <CardTitle className="text-base font-bold text-[#002446] flex items-center justify-between">
                    <span>Daftar Parameter Butir Soal ({analysisData.questions.length})</span>
                    <span className="text-xs text-gray-500 font-normal">Klik butir soal untuk melihat detail efektivitas distraktor</span>
                  </CardTitle>
                </CardHeader>

                <div className="divide-y divide-gray-100">
                  {analysisData.questions.map((q) => {
                    const isExpanded = expandedQuestionId === q.id;

                    const difficultyBadgeColor =
                      q.difficultyLabel === 'Mudah'
                        ? 'bg-emerald-100 text-emerald-800'
                        : q.difficultyLabel === 'Sedang'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-rose-100 text-rose-800';

                    const discriminationBadgeColor =
                      q.discriminationLabel === 'Sangat Baik'
                        ? 'bg-emerald-100 text-emerald-800'
                        : q.discriminationLabel === 'Baik'
                        ? 'bg-blue-100 text-blue-800'
                        : q.discriminationLabel === 'Cukup'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800';

                    return (
                      <div key={q.id} className="transition-colors hover:bg-gray-50/50">
                        <div
                          onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                          className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                        >
                          <div className="flex items-start gap-3 flex-1">
                            <div className="w-7 h-7 rounded-full bg-[#002446] text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {q.order}
                            </div>
                            <div className="space-y-1 flex-1">
                              <p className="text-sm font-semibold text-gray-900 line-clamp-2">{q.text}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Badge variant="outline" className="text-[10px]">
                                  {q.type === 'MULTIPLE_CHOICE' ? 'Pilihan Ganda' : 'Essay'}
                                </Badge>
                                <span>•</span>
                                <span>{q.points} Poin</span>
                                <span>•</span>
                                <span className="text-emerald-700 font-medium">Benar: {q.correctCount}</span>
                                <span>•</span>
                                <span className="text-rose-700 font-medium">Salah: {q.incorrectCount}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                            {/* Difficulty */}
                            <div className="text-right">
                              <div className="text-[11px] text-gray-400">Kesukaran (P)</div>
                              <div className="flex items-center gap-1.5 justify-end">
                                <span className="text-xs font-mono font-bold text-gray-700">{q.difficultyIndex}</span>
                                <Badge className={`${difficultyBadgeColor} text-[10px]`}>{q.difficultyLabel}</Badge>
                              </div>
                            </div>

                            {/* Discrimination */}
                            <div className="text-right">
                              <div className="text-[11px] text-gray-400">Pembeda (D)</div>
                              <div className="flex items-center gap-1.5 justify-end">
                                <span className="text-xs font-mono font-bold text-gray-700">{q.discriminationIndex}</span>
                                <Badge className={`${discriminationBadgeColor} text-[10px]`}>{q.discriminationLabel}</Badge>
                              </div>
                            </div>

                            <div className="text-gray-400 pl-2">
                              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded: Distractor / Essay Details */}
                        {isExpanded && (
                          <div className="p-4 bg-gray-50 border-t space-y-3">
                            <div className="text-xs font-bold text-[#002446] flex items-center gap-1.5">
                              <AlertCircle className="h-4 w-4 text-blue-600" />
                              <span>Rekomendasi Evaluasi:</span>
                              <span className="font-medium text-gray-700">{q.recommendation}</span>
                            </div>

                            {q.type === 'MULTIPLE_CHOICE' && q.optionsStats.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                  Efektivitas Pengecoh / Distraktor (Sebaran Jawaban Siswa):
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {q.optionsStats.map((opt, optIdx) => {
                                    const label = String.fromCharCode(65 + optIdx);
                                    const isDysfunctional = !opt.isCorrect && opt.count === 0;

                                    return (
                                      <div
                                        key={opt.id}
                                        className={`p-3 rounded-lg border text-xs relative ${
                                          opt.isCorrect
                                            ? 'bg-emerald-50/80 border-emerald-300'
                                            : isDysfunctional
                                            ? 'bg-rose-50/60 border-rose-200'
                                            : 'bg-white border-gray-200'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                          <span className="font-bold flex items-center gap-1.5">
                                            <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-mono">
                                              {label}
                                            </span>
                                            <span className="line-clamp-1">{opt.text}</span>
                                          </span>
                                          <div className="flex items-center gap-1 shrink-0">
                                            {opt.isCorrect && (
                                              <Badge className="bg-emerald-600 text-white text-[10px]">Kunci</Badge>
                                            )}
                                            {isDysfunctional && (
                                              <Badge className="bg-rose-600 text-white text-[10px]">Pengecoh Pasif (0%)</Badge>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2">
                                          <span>Dipilih {opt.count} siswa</span>
                                          <span className="font-bold font-mono">{opt.percentage}%</span>
                                        </div>
                                        {/* Visual progress bar */}
                                        <div className="w-full bg-gray-200 h-1.5 rounded-full mt-1 overflow-hidden">
                                          <div
                                            className={`h-full rounded-full ${
                                              opt.isCorrect ? 'bg-emerald-500' : 'bg-blue-400'
                                            }`}
                                            style={{ width: `${opt.percentage}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {q.type === 'ESSAY' && q.essayScoresSummary && (
                              <div className="p-3 bg-white rounded-lg border text-xs space-y-1">
                                <div className="font-bold text-[#002446]">Statistik Jawaban Essay:</div>
                                <div className="text-gray-600">
                                  Rata-rata Skor: <strong>{q.essayScoresSummary.averageScore}</strong> / {q.points} (
                                  Tertinggi: {q.essayScoresSummary.highestScore}, Terendah: {q.essayScoresSummary.lowestScore})
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* TAB 3: PROGRAM REMEDIAL */}
      {activeTab === 'remedial' && (
        <div className="space-y-6">
          {/* Header Action Banner */}
          <div className="p-5 bg-linear-to-r from-[#002446] to-[#013567] text-white rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-[#FF8928]" />
                <h2 className="text-xl font-bold">Program Remedial Terarah</h2>
              </div>
              <p className="text-xs text-white/80 max-w-xl">
                Bantu siswa yang belum mencapai KKM (<strong>{passingGrade}</strong>) melalui kuis perbaikan terfokus. Nilai kuis remedial akan memperbarui nilai kuis asal dengan batas maksimal sebesar KKM.
              </p>
            </div>

            <Button
              onClick={() => setIsRemedialModalOpen(true)}
              disabled={!remedialData || remedialData.remedialStudents.length === 0}
              className="bg-[#FF8928] hover:bg-[#ff7b10] text-white font-bold px-6 shrink-0 flex items-center gap-2 shadow-md"
            >
              <Sparkles className="h-4 w-4" />
              Buat Kuis Remedial
            </Button>
          </div>

          {/* Remedial Students List */}
          <Card className="bg-white shadow-sm border">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-[#002446] flex items-center gap-2">
                <User className="h-5 w-5 text-rose-600" />
                Daftar Siswa di Bawah KKM ({remedialData?.remedialStudents.length || 0})
              </CardTitle>
              <Badge variant="outline" className="text-xs font-semibold">
                Batas KKM: {passingGrade}
              </Badge>
            </CardHeader>

            <CardContent className="p-0">
              {!remedialData || remedialData.remedialStudents.length === 0 ? (
                <div className="p-8 text-center text-emerald-700 bg-emerald-50/50">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
                  <div className="font-bold text-base">Semua Siswa Telah Mencapai KKM!</div>
                  <p className="text-xs text-emerald-600 mt-1">
                    Tidak ada siswa yang memiliki nilai di bawah {passingGrade} pada kuis ini.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b text-gray-600 text-xs uppercase tracking-wider">
                        <th className="py-3 px-4 w-12 text-center">No</th>
                        <th className="py-3 px-4">Nama Siswa</th>
                        <th className="py-3 px-4 text-center">NIS</th>
                        <th className="py-3 px-4 text-center">Nilai Terbaik</th>
                        <th className="py-3 px-4 text-center">Soal Salah</th>
                        <th className="py-3 px-4">Waktu Terakhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {remedialData.remedialStudents.map((st, idx) => (
                        <tr key={st.userId} className="hover:bg-gray-50/80">
                          <td className="py-3.5 px-4 text-center text-gray-500 font-medium">{idx + 1}</td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-gray-900">{st.name}</div>
                            <div className="text-xs text-gray-400">{st.email}</div>
                          </td>
                          <td className="py-3.5 px-4 text-center text-xs text-gray-600 font-mono">
                            {st.nis || '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                              {st.bestScore} / 100
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <Badge variant="outline" className="text-xs font-semibold text-rose-700 bg-rose-50 border-rose-200">
                              {st.wrongQuestionIds.length} Soal
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-gray-500">
                            {st.submittedAt ? new Date(st.submittedAt).toLocaleDateString('id-ID') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Missed Questions Breakdown */}
          {remedialData && remedialData.mostFailedQuestions.length > 0 && (
            <Card className="bg-white shadow-sm border">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-bold text-[#002446] flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Butir Soal yang Paling Sering Dijawab Salah
                </CardTitle>
                <p className="text-xs text-gray-500">
                  Butir-butir soal ini paling banyak digagalkan oleh siswa yang belum tuntas, dan disarankan dimasukkan ke dalam kuis remedial.
                </p>
              </CardHeader>

              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {remedialData.mostFailedQuestions.slice(0, 6).map((q, idx) => (
                    <div key={q.questionId} className="p-3.5 rounded-lg border bg-amber-50/40 border-amber-200 text-xs space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-amber-900"># Prioritas {idx + 1}</span>
                        <Badge className="bg-rose-600 text-white text-[10px]">
                          {q.failCount} Siswa Salah ({q.failPercentage}%)
                        </Badge>
                      </div>
                      <p className="text-gray-800 font-medium line-clamp-2">{q.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Remedials History */}
          {remedialData && remedialData.existingRemedials.length > 0 && (
            <Card className="bg-white shadow-sm border">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-bold text-[#002446] flex items-center gap-2">
                  <Award className="h-5 w-5 text-indigo-600" />
                  Riwayat Kuis Remedial yang Telah Diterbitkan ({remedialData.existingRemedials.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <div className="divide-y divide-gray-100">
                  {remedialData.existingRemedials.map((r) => (
                    <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                          <span>{r.title}</span>
                          <Badge className="bg-amber-100 text-amber-900 text-[10px]">Remedial</Badge>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Dibuat pada {new Date(r.createdAt).toLocaleDateString('id-ID')} • {r._count.questions} Soal • {r._count.attempts} Siswa Mengerjakan
                        </div>
                      </div>

                      <Link href={`/teacher/course/${data.quiz.courseId}/quiz-attempts/${r.id}`}>
                        <Button variant="outline" size="sm" className="text-xs flex items-center gap-1">
                          <span>Lihat Riwayat</span>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* MODAL: GENERATE REMEDIAL QUIZ */}
      <Dialog open={isRemedialModalOpen} onOpenChange={setIsRemedialModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446] flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#FF8928]" />
              Buat Kuis Remedial Terarah
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateRemedialQuiz} className="space-y-5 py-2">
            <div className="space-y-3">
              <div>
                <Label htmlFor="remTitle" className="text-xs font-bold text-gray-700">Judul Kuis Remedial</Label>
                <Input
                  id="remTitle"
                  value={remedialTitle}
                  onChange={(e) => setRemedialTitle(e.target.value)}
                  required
                  className="mt-1 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="remDuration" className="text-xs font-bold text-gray-700">Durasi (Menit)</Label>
                  <Input
                    id="remDuration"
                    type="number"
                    min={1}
                    value={remedialDuration}
                    onChange={(e) => setRemedialDuration(Number(e.target.value))}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-gray-700">Batas Nilai Maksimal (KKM)</Label>
                  <Input
                    disabled
                    value={`${passingGrade} (Sesuai KKM Induk)`}
                    className="mt-1 bg-gray-100 text-gray-600 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Target Students Selection */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-[#002446] uppercase tracking-wider">
                  Target Siswa Remedial ({selectedStudentIds.length}/{remedialData?.remedialStudents.length || 0} Terpilih)
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleAllStudents}
                  className="text-xs text-blue-700 hover:text-blue-900 h-7 px-2"
                >
                  {selectedStudentIds.length === (remedialData?.remedialStudents.length || 0)
                    ? 'Batal Pilih Semua'
                    : 'Pilih Semua'}
                </Button>
              </div>

              <div className="max-h-36 overflow-y-auto border rounded-lg divide-y divide-gray-100 bg-gray-50/50 p-1">
                {remedialData?.remedialStudents.map((st) => {
                  const isChecked = selectedStudentIds.includes(st.userId);
                  return (
                    <label
                      key={st.userId}
                      className="flex items-center justify-between p-2.5 hover:bg-white rounded cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleStudent(st.userId)}
                          className="h-4 w-4 rounded border-gray-300 text-[#002446] focus:ring-[#002446]"
                        />
                        <div>
                          <div className="text-xs font-bold text-gray-900">{st.name}</div>
                          <div className="text-[11px] text-gray-500">NIS: {st.nis || '-'}</div>
                        </div>
                      </div>
                      <Badge className="bg-rose-100 text-rose-800 text-[10px]">
                        Nilai Asal: {st.bestScore}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Question Selection */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-[#002446] uppercase tracking-wider">
                  Pilih Butir Soal ({selectedQuestionIds.length}/{data.questions.length} Terpilih)
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectFailedQuestions}
                    className="text-xs text-amber-800 border-amber-300 bg-amber-50 hover:bg-amber-100 h-7 px-2"
                  >
                    Hanya Soal Gagal
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllQuestions}
                    className="text-xs text-blue-700 hover:text-blue-900 h-7 px-2"
                  >
                    {selectedQuestionIds.length === data.questions.length ? 'Batal Semua' : 'Semua Soal'}
                  </Button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y divide-gray-100 bg-gray-50/50 p-1">
                {data.questions.map((q, idx) => {
                  const isChecked = selectedQuestionIds.includes(q.id);
                  const isMostFailed = remedialData?.mostFailedQuestions.some(
                    (mf) => mf.questionId === q.id
                  );

                  return (
                    <label
                      key={q.id}
                      className="flex items-start gap-2.5 p-2.5 hover:bg-white rounded cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleQuestion(q.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-[#002446] focus:ring-[#002446]"
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#002446]">Soal #{idx + 1}</span>
                          {isMostFailed && (
                            <Badge className="bg-amber-100 text-amber-900 text-[9px] border border-amber-300">
                              Sering Salah
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-700 line-clamp-2">{q.text}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Kuis remedial akan otomatis dibuat dan dipublikasikan pada modul pembelajaran yang sama. Hanya siswa target yang dapat membuka dan mengerjakan kuis ini.
              </span>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRemedialModalOpen(false)}
                disabled={isGeneratingRemedial}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isGeneratingRemedial}
                className="bg-[#FF8928] hover:bg-[#ff7b10] text-white font-bold"
              >
                {isGeneratingRemedial ? 'Membuat Kuis...' : 'Terbitkan Kuis Remedial'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: DETAIL JAWABAN SISWA (ATTEMPT INSPECTION) */}
      <Dialog open={!!selectedAttempt} onOpenChange={(open) => !open && setSelectedAttempt(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedAttempt && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl font-bold text-[#002446]">
                      Lembar Jawaban: {selectedAttempt.user.name}
                    </DialogTitle>
                    <p className="text-xs text-gray-500 mt-1">
                      NIS: {selectedAttempt.user.nis || '-'} • Dikumpulkan pada:{' '}
                      {selectedAttempt.submittedAt
                        ? new Date(selectedAttempt.submittedAt).toLocaleString('id-ID')
                        : '-'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Nilai Akhir</div>
                    <div
                      className={`text-2xl font-black ${
                        (selectedAttempt.score ?? 0) >= passingGrade
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {selectedAttempt.score ?? '-'} / 100
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 divide-y divide-gray-100">
                {selectedAttempt.answers.map((ans, index) => {
                  const isEssay = ans.question.type === 'ESSAY';
                  const isCorrect = !isEssay && ans.score === ans.question.points;

                  return (
                    <div key={ans.id} className="pt-4 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-sm text-[#002446]">#{index + 1}</span>
                          <div>
                            <p className="text-sm text-gray-900 font-medium">{ans.question.text}</p>
                            <span className="text-xs text-gray-400 font-mono">
                              ({isEssay ? 'Soal Essay' : 'Pilihan Ganda'} • Bobot: {ans.question.points} Poin)
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          {isEssay ? (
                            ans.score !== null ? (
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
                                {ans.score} / {ans.question.points} Pts
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">
                                Belum Dinilai
                              </span>
                            )
                          ) : (
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {ans.score ?? 0} / {ans.question.points} Pts
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Student Answer Box */}
                      <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                        <span className="text-xs text-gray-500 font-bold block mb-1">Jawaban Siswa:</span>
                        <p className="text-gray-800 whitespace-pre-wrap">
                          {ans.answer ? ans.answer : <span className="italic text-gray-400">Tidak menjawab</span>}
                        </p>
                      </div>

                      {/* Teacher Note & Essay Grade Action */}
                      {isEssay && (
                        <div className="flex items-center justify-between pt-1">
                          <div className="text-xs text-gray-500">
                            {ans.teacherNote ? (
                              <span>
                                <strong>Catatan Guru:</strong> {ans.teacherNote}
                              </span>
                            ) : (
                              <span className="italic">Belum ada catatan</span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEssayGrade(ans)}
                            className="text-xs border-[#002446] text-[#002446] hover:bg-[#002446] hover:text-white"
                          >
                            Beri Nilai Essay
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedAttempt(null)}>
                  Tutup
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: INPUT NILAI ESSAY */}
      <Dialog open={!!gradingAnswer} onOpenChange={(open) => !open && setGradingAnswer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#002446]">
              Penilaian Jawaban Essay
            </DialogTitle>
          </DialogHeader>

          {gradingAnswer && (
            <form onSubmit={handleSaveEssayGrade} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500">Pertanyaan:</Label>
                <div className="p-2.5 bg-gray-50 rounded border text-sm text-gray-800">
                  {gradingAnswer.questionText}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500">Jawaban Siswa:</Label>
                <div className="p-2.5 bg-gray-50 rounded border text-sm text-gray-800 whitespace-pre-wrap">
                  {gradingAnswer.studentAnswer}
                </div>
              </div>

              <div className="space-y-3 pt-2">
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setGradingAnswer(null)}
                  disabled={loading}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={loading} className="bg-[#FF8928] text-white font-bold">
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
