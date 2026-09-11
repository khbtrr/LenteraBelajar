'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Clock, CheckCircle2, AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Send, LayoutGrid, AlertCircle } from 'lucide-react';
import { submitQuizAttempt } from '@/lib/actions/quiz';
import { Link } from '@/i18n/navigation';

interface QuestionOption {
  id: string;
  text: string;
}

interface Question {
  id: string;
  type: 'MULTIPLE_CHOICE' | 'ESSAY';
  text: string;
  points: number;
  options: QuestionOption[] | null;
}

export function StudentQuizClient({
  courseId,
  quizId,
  initialAttempt,
  quizTitle,
  durationMinutes,
  questions,
  questionsPerPage = 0,
}: {
  courseId: string;
  quizId: string;
  initialAttempt: any;
  quizTitle: string;
  durationMinutes: number | null;
  questions: Question[];
  questionsPerPage?: number;
}) {
  const storageKey = `quiz_draft_${initialAttempt.id}`;

  // Check if attempt is already submitted
  const [isSubmitted, setIsSubmitted] = useState(Boolean(initialAttempt.submittedAt));
  const [submissionResult, setSubmissionResult] = useState<{
    score: number | null;
    isGraded: boolean;
  } | null>(
    initialAttempt.submittedAt
      ? { score: initialAttempt.score, isGraded: initialAttempt.isGraded }
      : null
  );

  // Initialize answers from server attempt.answers merged with local cache
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const loaded: Record<string, string> = {};
    if (Array.isArray(initialAttempt.answers)) {
      for (const a of initialAttempt.answers) {
        if (a.questionId && a.answer) {
          loaded[a.questionId] = a.answer;
        }
      }
    }
    if (typeof window !== 'undefined') {
      try {
        const savedLocal = localStorage.getItem(storageKey);
        if (savedLocal) {
          const parsed = JSON.parse(savedLocal);
          Object.assign(loaded, parsed);
        }
      } catch (e) {
        console.warn('Failed to parse local quiz draft:', e);
      }
    }
    return loaded;
  });

  const answersRef = useRef<Record<string, string>>(answers);
  const [loading, setLoading] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [timeUpLoading, setTimeUpLoading] = useState(false);
  const [timeUpError, setTimeUpError] = useState<string | null>(null);

  // Modal states for submit confirmation & error alert
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);

  // Active question index for 1 Question Per Page (Moodle-style) mode
  const [currentIndex, setCurrentIndex] = useState(0);

  // Keep answersRef strictly synced and persist to localStorage instantly
  useEffect(() => {
    answersRef.current = answers;
    if (typeof window !== 'undefined' && !isSubmitted) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(answers));
      } catch (e) {
        // ignore quota error
      }
    }
  }, [answers, isSubmitted, storageKey]);

  // Debounced background sync to server (/api/quiz/draft) every 2 seconds after typing
  useEffect(() => {
    if (isSubmitted || isTimeUp) return;
    const entries = Object.entries(answers);
    if (entries.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        const payload = entries.map(([questionId, answer]) => ({
          questionId,
          answer,
        }));
        await fetch('/api/quiz/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attemptId: initialAttempt.id,
            answers: payload,
          }),
        });
      } catch (e) {
        // silently fail background draft sync; local storage still holds it
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [answers, isSubmitted, isTimeUp, initialAttempt.id]);

  // Countdown Timer Calculation
  const calculateRemainingSeconds = () => {
    if (!durationMinutes) return null;
    const startTime = new Date(initialAttempt.startedAt).getTime();
    const durationMs = durationMinutes * 60 * 1000;
    const endTime = startTime + durationMs;
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
    return remaining;
  };

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    calculateRemainingSeconds()
  );

  const hasAutoSubmitted = useRef(false);

  useEffect(() => {
    if (isSubmitted || remainingSeconds === null) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          if (!hasAutoSubmitted.current) {
            hasAutoSubmitted.current = true;
            handleAutoSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isSubmitted]);

  const handleSelectAnswer = (questionId: string, answer: string) => {
    if (isSubmitted || isTimeUp) return;
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  // Robust answer sender: tries REST API endpoint first to avoid Server Action deployment hash mismatch, falls back to server action
  const sendAnswersToServer = async (answersPayload: { questionId: string; answer: string }[]) => {
    try {
      const response = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: initialAttempt.id,
          answers: answersPayload,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }
      const errData = await response.json().catch(() => null);
      if (errData?.error) {
        throw new Error(errData.error);
      }
    } catch (apiErr: any) {
      console.warn('API route submission failed, trying server action fallback...', apiErr);
      try {
        const res = await submitQuizAttempt(initialAttempt.id, answersPayload);
        return res;
      } catch (actionErr: any) {
        throw new Error(actionErr?.message || apiErr?.message || 'Gagal mengirimkan jawaban ke server.');
      }
    }
  };

  const handleAutoSubmit = async () => {
    setIsTimeUp(true);
    setTimeUpLoading(true);
    setTimeUpError(null);

    const currentAnswers = answersRef.current;
    const formattedAnswers = Object.entries(currentAnswers).map(([qId, ans]) => ({
      questionId: qId,
      answer: ans,
    }));

    try {
      const res = await sendAnswersToServer(formattedAnswers);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(storageKey);
      }
      setSubmissionResult(res);
      setIsSubmitted(true);
    } catch (err: any) {
      console.error('Auto-submit error:', err);
      setTimeUpError(err?.message || 'Gagal menyimpan jawaban otomatis. Silakan periksa koneksi Anda.');
    } finally {
      setTimeUpLoading(false);
    }
  };

  const handleOpenSubmitConfirm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitted || loading) return;
    setIsConfirmModalOpen(true);
  };

  const handleExecuteSubmit = async () => {
    setIsConfirmModalOpen(false);
    setLoading(true);
    setSubmitErrorMessage(null);

    try {
      const formattedAnswers = Object.entries(answers).map(([qId, ans]) => ({
        questionId: qId,
        answer: ans,
      }));
      const res = await sendAnswersToServer(formattedAnswers);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(storageKey);
      }
      setSubmissionResult(res);
      setIsSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setSubmitErrorMessage(err?.message || 'Gagal mengumpulkan kuis. Pastikan koneksi internet aktif lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // Keyboard arrow navigation for 1-question-per-page mode
  const isOnePerPage = questionsPerPage === 1;
  useEffect(() => {
    if (!isOnePerPage || isSubmitted || isTimeUp) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOnePerPage, isSubmitted, isTimeUp, questions.length]);

  const formatTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).filter((k) => answers[k]?.trim()).length;

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-6">
        <Card className="border-green-200 bg-white shadow-md text-center p-8">
          <CardContent className="space-y-4 pt-4">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-600" />
            <h2 className="text-2xl font-bold text-[#002446]">
              Kuis Berhasil Dikumpulkan!
            </h2>
            <p className="text-sm text-gray-600">
              Jawaban Anda untuk <strong>{quizTitle}</strong> telah tersimpan di sistem.
            </p>

            {submissionResult?.score !== null && submissionResult?.score !== undefined ? (
              <div className="p-6 bg-blue-50 border border-blue-200 rounded-xl max-w-sm mx-auto my-4">
                <div className="text-xs uppercase font-bold text-[#FF8928] tracking-wider">
                  Nilai Akhir (Auto-Graded)
                </div>
                <div className="text-4xl font-extrabold text-[#002446] mt-2">
                  {submissionResult.score} / 100
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg max-w-md mx-auto">
                Kuis ini memiliki soal essay yang memerlukan penilaian manual oleh guru. Nilai akhir akan diperbarui setelah diperiksa.
              </div>
            )}

            <div className="pt-4">
              <Button onClick={() => window.location.href = `/student/course/${courseId}/quiz/${quizId}`} className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-2 mx-auto">
                <ArrowLeft className="h-4 w-4" /> Kembali ke Detail Kuis
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Helper renderer for a single question card
  const renderQuestionCard = (q: Question, idx: number) => (
    <Card key={q.id} className="border border-gray-200 shadow-sm bg-white">
      <CardHeader className="p-5 pb-3 flex flex-row items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center h-6 w-6 rounded bg-gray-100 text-[#002446] text-xs font-bold">
            {idx + 1}
          </span>
          <Badge variant="outline" className="text-xs">
            {q.type === 'MULTIPLE_CHOICE' ? 'Pilihan Ganda' : 'Essay'}
          </Badge>
          {answers[q.id]?.trim() && (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
              ✓ Sudah Dijawab
            </Badge>
          )}
        </div>
        <span className="text-xs text-gray-400 font-medium">
          {q.points} Poin
        </span>
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-4">
        <div
          className="text-base text-gray-800 font-medium leading-relaxed whitespace-pre-line [&_img]:max-w-full [&_img]:max-h-96 [&_img]:rounded-lg [&_img]:my-3 [&_img]:border [&_img]:border-gray-200 [&_img]:shadow-xs"
          dangerouslySetInnerHTML={{ __html: q.text }}
        />

        {/* Multiple Choice Options */}
        {q.type === 'MULTIPLE_CHOICE' && q.options && (
          <div className="space-y-2 pt-2">
            {q.options.map((opt) => {
              const isSelected = answers[q.id] === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelectAnswer(q.id, opt.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50/80 border-[#002446] text-[#002446] font-medium shadow-sm'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100/70 text-gray-700'
                  }`}
                >
                  <div
                    className={`flex items-center justify-center h-5 w-5 rounded-full border transition-all shrink-0 ${
                      isSelected
                        ? 'border-[#002446] bg-[#002446]'
                        : 'border-gray-400 bg-white'
                    }`}
                  >
                    {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm flex-1 leading-relaxed">{opt.text}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Essay Textarea */}
        {q.type === 'ESSAY' && (
          <div className="pt-2">
            <textarea
              rows={5}
              placeholder="Tuliskan jawaban uraian Anda secara rinci di sini..."
              value={answers[q.id] || ''}
              onChange={(e) => handleSelectAnswer(q.id, e.target.value)}
              className="w-full p-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className={`space-y-6 mx-auto pb-16 ${isOnePerPage ? 'max-w-5xl' : 'max-w-3xl'}`}>
      {/* Sticky Countdown Header */}
      <div className="sticky top-20 z-20 bg-white/95 backdrop-blur shadow-sm border border-gray-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-[#002446] text-base">{quizTitle}</h2>
          <div className="text-xs text-gray-500">
            Terjawab: <strong>{answeredCount}</strong> dari {questions.length} Soal
          </div>
        </div>

        {remainingSeconds !== null && (
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-bold text-lg ${
              remainingSeconds < 300
                ? 'bg-red-100 text-red-700 animate-pulse'
                : 'bg-[#002446] text-white'
            }`}
          >
            <Clock className="h-5 w-5" />
            <span>{formatTime(remainingSeconds)}</span>
          </div>
        )}
      </div>

      {isOnePerPage ? (
        /* MODE: 1 Soal per Halaman (Moodle / CBT Style) */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Question Area (3 cols) */}
          <div className="lg:col-span-3 space-y-6">
            {questions[currentIndex] && renderQuestionCard(questions[currentIndex], currentIndex)}

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="flex items-center gap-1.5 w-full sm:w-auto"
              >
                <ChevronLeft className="w-4 h-4" /> Soal Sebelumnya
              </Button>

              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-gray-400 select-none">
                <span>Pindah soal:</span>
                <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-600 font-mono text-[10px]">←</kbd>
                <span>/</span>
                <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-600 font-mono text-[10px]">→</kbd>
              </div>

              {currentIndex < questions.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-1.5 w-full sm:w-auto"
                >
                  Soal Selanjutnya <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => handleOpenSubmitConfirm()}
                  className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white font-bold flex items-center gap-1.5 w-full sm:w-auto"
                >
                  {loading ? 'Mengumpulkan...' : 'Kumpulkan Kuis'} <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Question Palette Map Sidebar (1 col) */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="border border-gray-200 shadow-sm bg-white p-4 sticky top-40">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <LayoutGrid className="w-4 h-4 text-[#FF8928]" />
                <h3 className="font-bold text-xs text-[#002446] uppercase tracking-wider">
                  Navigasi Soal
                </h3>
              </div>

              {/* Number Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pt-3">
                {questions.map((q, qIdx) => {
                  const isCurrent = currentIndex === qIdx;
                  const isAnswered = Boolean(answers[q.id]?.trim());

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIndex(qIdx)}
                      className={`h-9 w-9 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${
                        isCurrent
                          ? 'ring-2 ring-[#FF8928] ring-offset-2 bg-[#002446] text-white shadow-sm'
                          : isAnswered
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                      }`}
                      title={`Soal #${qIdx + 1}: ${isAnswered ? 'Sudah dijawab' : 'Belum dijawab'}`}
                    >
                      {qIdx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="space-y-1.5 pt-4 text-[11px] text-gray-500 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-[#002446] ring-1 ring-[#FF8928]" />
                  <span>Soal Aktif</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
                  <span>Sudah Dijawab</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-gray-100 border border-gray-300" />
                  <span>Belum Dijawab</span>
                </div>
              </div>

              {/* Direct Submit from Palette */}
              <div className="pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => handleOpenSubmitConfirm()}
                  className="w-full bg-[#FF8928] hover:bg-[#FF8928]/90 text-white text-xs font-bold py-2"
                >
                  {loading ? 'Mengumpulkan...' : 'Kumpulkan Kuis'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* MODE: Semua Soal dalam 1 Halaman (Classic List) */
        <form onSubmit={handleOpenSubmitConfirm} className="space-y-6">
          {questions.map((q, idx) => renderQuestionCard(q, idx))}

          <div className="flex justify-between items-center pt-4">
            <div className="text-xs text-gray-500">
              Pastikan seluruh pertanyaan telah dijawab sebelum mengirimkan.
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white font-bold px-8 py-2.5 h-auto text-base"
            >
              {loading ? 'Mengumpulkan...' : 'Kumpulkan Jawaban Kuis'}
            </Button>
          </div>
        </form>
      )}

      {/* Confirmation Modal for Submitting Quiz */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="max-w-md p-6 bg-white border border-gray-200">
          <DialogHeader className="space-y-3 text-center sm:text-center">
            {questions.length - answeredCount > 0 ? (
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
            ) : (
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            )}

            <DialogTitle className="text-xl font-bold text-[#002446]">
              {questions.length - answeredCount > 0
                ? 'Ada Soal Belum Terjawab'
                : 'Kumpulkan Kuis Sekarang?'}
            </DialogTitle>

            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              {questions.length - answeredCount > 0 ? (
                <>
                  Masih ada <strong className="text-red-600 font-bold">{questions.length - answeredCount}</strong> dari{' '}
                  <strong>{questions.length}</strong> butir soal yang belum Anda jawab. Apakah Anda yakin ingin tetap mengumpulkan kuis ini sekarang?
                </>
              ) : (
                <>
                  Seluruh <strong>{questions.length}</strong> butir soal telah selesai Anda jawab. Apakah Anda yakin ingin menyelesaikan dan mengumpulkan kuis ini sekarang?
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Quick Stat Pill */}
          <div className="my-2 p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between text-xs text-gray-600">
            <span>Terjawab: <strong className="text-emerald-700">{answeredCount}</strong></span>
            <span>Belum dijawab: <strong className="text-amber-700">{questions.length - answeredCount}</strong></span>
            <span>Total: <strong>{questions.length} Soal</strong></span>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmModalOpen(false)}
              className="w-full sm:w-1/2"
            >
              {questions.length - answeredCount > 0 ? 'Lanjut Mengerjakan' : 'Periksa Kembali'}
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={handleExecuteSubmit}
              className={`w-full sm:w-1/2 text-white font-bold ${
                questions.length - answeredCount > 0
                  ? 'bg-[#FF8928] hover:bg-[#FF8928]/90'
                  : 'bg-[#002446] hover:bg-[#002446]/90'
              }`}
            >
              {loading ? 'Mengumpulkan...' : 'Ya, Kumpulkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Modal if Submission Fails */}
      <Dialog open={Boolean(submitErrorMessage)} onOpenChange={(open) => !open && setSubmitErrorMessage(null)}>
        <DialogContent className="max-w-md p-6 bg-white border border-red-200 text-center">
          <DialogHeader className="space-y-3 text-center sm:text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <DialogTitle className="text-lg font-bold text-red-700">
              Gagal Mengumpulkan Kuis
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              {submitErrorMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-3">
            <Button
              type="button"
              onClick={() => setSubmitErrorMessage(null)}
              className="w-full bg-[#002446] hover:bg-[#002446]/90 text-white font-bold"
            >
              Tutup & Coba Lagi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Time Up Overlay Modal */}
      {isTimeUp && !isSubmitted && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 text-center shadow-2xl bg-white border-2 border-red-200 animate-in fade-in zoom-in duration-200">
            <CardContent className="pt-2 space-y-4">
              {timeUpLoading ? (
                <div className="space-y-4 py-4">
                  <div className="mx-auto w-14 h-14 border-4 border-[#002446]/20 border-t-[#FF8928] rounded-full animate-spin" />
                  <h3 className="text-xl font-bold text-[#002446]">Waktu Habis!</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Waktu pengerjaan kuis telah habis. Seluruh jawaban Anda sedang disimpan dan dikumpulkan secara otomatis ke server...
                  </p>
                </div>
              ) : timeUpError ? (
                <div className="space-y-4 py-2">
                  <AlertTriangle className="mx-auto h-14 w-14 text-red-500" />
                  <h3 className="text-xl font-bold text-red-700">Gagal Menyimpan Otomatis</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {timeUpError}
                  </p>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 text-left">
                    <strong>Catatan:</strong> Jawaban Anda tidak hilang dan masih tersimpan di perangkat ini. Pastikan koneksi internet aktif lalu klik tombol di bawah.
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleAutoSubmit()}
                    className="w-full bg-[#FF8928] hover:bg-[#FF8928]/90 text-white font-bold py-2.5"
                  >
                    Coba Kirim Ulang Sekarang
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

