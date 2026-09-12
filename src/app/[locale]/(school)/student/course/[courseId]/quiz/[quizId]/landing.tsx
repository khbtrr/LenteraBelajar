'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Calendar, HelpCircle, ArrowLeft, ArrowRight, Trophy, AlertTriangle, CheckCircle2, XCircle, Target, RotateCcw, KeyRound, Shield, ShieldAlert } from 'lucide-react';
import { startOrGetQuizAttempt } from '@/lib/actions/quiz';
import { StudentQuizClient } from './client';
import { Link } from '@/i18n/navigation';

export function StudentQuizLanding({ courseId, quiz, status }: { courseId: string; quiz: any; status: any }) {
  const [quizData, setQuizData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');

  const isLockdown = Boolean(quiz.enableLockdown || status.enableLockdown);
  const isRequireToken = Boolean(quiz.requireToken || status.requireToken);
  const maxTabSwitches = quiz.maxTabSwitches || status.maxTabSwitches || 3;

  const canAttempt = status.status !== 'EXPIRED' && (
    status.status !== 'COMPLETED' || 
    status.maxAttempts === null || 
    status.submittedCount < (status.maxAttempts || 1)
  );
  const isInProgress = status.status === 'IN_PROGRESS';

  const handleStart = async () => {
    if (isRequireToken && !isInProgress && !tokenInput.trim()) {
      setError('Harap masukkan token akses ujian yang diberikan guru pengawas.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await startOrGetQuizAttempt(quiz.id, tokenInput.trim());
      setQuizData(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memulai kuis');
    } finally {
      setLoading(false);
    }
  };

  // If quiz has started, show the quiz client
  if (quizData) {
    return (
      <StudentQuizClient
        courseId={courseId}
        quizId={quiz.id}
        initialAttempt={quizData.attempt}
        quizTitle={quizData.quizTitle}
        durationMinutes={quizData.durationMinutes}
        questions={quizData.questions}
        questionsPerPage={quizData.questionsPerPage}
        enableLockdown={quizData.enableLockdown}
        maxTabSwitches={quizData.maxTabSwitches}
      />
    );
  }

  // Landing page
  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <Link href={`/student/course/${courseId}/modules`}>
        <Button variant="ghost" size="sm" className="text-gray-500 hover:text-[#002446] flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Materi
        </Button>
      </Link>

      {/* Quiz Info Card */}
      <Card className="border-2 border-[#002446]/20 shadow-lg">
        <CardHeader className="bg-[#002446] text-white p-6">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-8 w-8 text-[#FF8928]" />
            <div>
              <CardTitle className="text-xl font-bold">{quiz.title}</CardTitle>
              {quiz.description && <p className="text-sm text-white/80 mt-1">{quiz.description}</p>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-[#002446]">{quiz._count?.questions || quiz.questions?.length || 0}</div>
              <div className="text-xs text-gray-500">Soal</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-[#002446]">{quiz.duration || '∞'}</div>
              <div className="text-xs text-gray-500">Menit</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-[#002446]">{status.maxAttempts === null ? '∞' : status.maxAttempts}</div>
              <div className="text-xs text-gray-500">Kesempatan</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-[#002446]">{quiz.passingGrade ?? '-'}</div>
              <div className="text-xs text-gray-500">KKM</div>
            </div>
          </div>

          {quiz.deadline && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
              <Calendar className="h-4 w-4 text-amber-600" />
              Batas Waktu: <strong>{new Date(quiz.deadline).toLocaleString('id-ID')}</strong>
            </div>
          )}

          {quiz.passingGrade && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
              <Target className="h-4 w-4 text-blue-600" />
              Nilai Minimal Lulus (KKM): <strong>{quiz.passingGrade}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Previous Attempts */}
      {status.submittedCount > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-bold text-[#002446] flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#FF8928]" /> Riwayat Pengerjaan ({status.submittedCount}x)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {/* show best score and latest attempt info */}
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              {status.bestScore !== null && (
                <div>
                  <div className="text-xs text-gray-500">Nilai Terbaik</div>
                  <div className={`text-2xl font-bold ${status.passed === true ? 'text-green-700' : status.passed === false ? 'text-red-700' : 'text-[#002446]'}`}>
                    {status.bestScore}/100
                  </div>
                </div>
              )}
              {status.passed !== null && (
                <Badge className={status.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                  {status.passed ? '✓ Lulus' : '✗ Tidak Lulus'}
                </Badge>
              )}
              <div className="ml-auto text-right">
                <div className="text-xs text-gray-500">Percobaan</div>
                <div className="text-lg font-bold text-[#002446]">
                  {status.submittedCount}/{status.maxAttempts === null ? '∞' : status.maxAttempts}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lockdown Rules Card */}
      {isLockdown && (
        <Card className="border-2 border-rose-300 bg-rose-50/60 shadow-sm">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
              <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
              Peraturan Mode Ujian Aman (CBT Lockdown)
            </div>
            <ul className="text-xs text-rose-700 space-y-1 list-disc pl-5">
              <li>Ujian akan secara otomatis meminta tampilan <strong>Layar Penuh (Fullscreen)</strong>.</li>
              <li>Dilarang berpindah tab browser, membuka aplikasi lain, atau meminimalkan layar.</li>
              <li>
                Batas toleransi meninggalkan layar ujian adalah <strong>{maxTabSwitches} kali</strong>. Jika melanggar melebihi batas, lembar ujian Anda akan <strong>otomatis ter-submit</strong>.
              </li>
              <li>Fungsi klik kanan, copy-paste, dan pintasan keyboard tertentu dinonaktifkan demi integritas ujian.</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Token Input Box */}
      {isRequireToken && !isInProgress && canAttempt && status.status !== 'EXPIRED' && (
        <Card className="border border-gray-200 bg-white shadow-sm p-4 text-center space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cbtTokenInput" className="text-xs font-bold text-gray-700 flex items-center justify-center gap-1.5">
              <KeyRound className="h-4 w-4 text-[#FF8928]" /> Masukkan Token Akses Ujian
            </Label>
            <p className="text-[11px] text-gray-500">
              Minta kode token kepada guru atau pengawas di ruangan ujian Anda.
            </p>
          </div>
          <div className="max-w-xs mx-auto">
            <Input
              id="cbtTokenInput"
              placeholder="Contoh: PAS2026"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
              maxLength={8}
              className="font-mono text-center text-lg font-bold tracking-widest uppercase h-11 bg-gray-50 border-2 border-gray-300 focus:border-[#002446]"
            />
          </div>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Action Button */}
      <div className="flex justify-center">
        {status.status === 'EXPIRED' ? (
          <Button disabled size="lg" className="bg-gray-300 text-gray-600 cursor-not-allowed px-12">
            Batas Waktu Habis
          </Button>
        ) : !canAttempt ? (
          <Button disabled size="lg" className="bg-gray-300 text-gray-600 cursor-not-allowed px-12">
            Kesempatan Mengerjakan Habis ({status.submittedCount}/{status.maxAttempts})
          </Button>
        ) : (
          <Button
            onClick={handleStart}
            disabled={loading}
            size="lg"
            className={`px-12 text-lg font-bold ${isInProgress ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#FF8928] hover:bg-[#FF8928]/90'} text-white flex items-center gap-2`}
          >
            {loading ? 'Mempersiapkan Kuis...' : isInProgress ? 'Lanjutkan Kuis' : status.submittedCount > 0 ? `Coba Lagi (Percobaan ke-${status.submittedCount + 1})` : 'Mulai Kerjakan Kuis'}
            <ArrowRight className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
