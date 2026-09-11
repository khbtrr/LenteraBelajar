'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
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
}: {
  courseId: string;
  quizId: string;
  initialAttempt: any;
  quizTitle: string;
  durationMinutes: number | null;
  questions: Question[];
}) {
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

  // Answers map: questionId -> answer
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

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
    if (isSubmitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleAutoSubmit = async () => {
    const formattedAnswers = Object.entries(answers).map(([qId, ans]) => ({
      questionId: qId,
      answer: ans,
    }));
    try {
      const res = await submitQuizAttempt(initialAttempt.id, formattedAnswers);
      setSubmissionResult(res);
      setIsSubmitted(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm('Apakah Anda yakin ingin mengumpulkan kuis ini sekarang?')) return;

    setLoading(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([qId, ans]) => ({
        questionId: qId,
        answer: ans,
      }));
      const res = await submitQuizAttempt(initialAttempt.id, formattedAnswers);
      setSubmissionResult(res);
      setIsSubmitted(true);
    } catch (err) {
      console.error(err);
      alert('Gagal mengumpulkan kuis');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).length;

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

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-16">
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

      {/* Questions List */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {questions.map((q, idx) => (
          <Card key={q.id} className="border border-gray-200 shadow-sm bg-white">
            <CardHeader className="p-5 pb-3 flex flex-row items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded bg-gray-100 text-[#002446] text-xs font-bold">
                  {idx + 1}
                </span>
                <Badge variant="outline" className="text-xs">
                  {q.type === 'MULTIPLE_CHOICE' ? 'Pilihan Ganda' : 'Essay'}
                </Badge>
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
                          className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold border ${
                            isSelected
                              ? 'bg-[#002446] text-white border-[#002446]'
                              : 'bg-white text-gray-600 border-gray-300'
                          }`}
                        >
                          {opt.id}
                        </div>
                        <span className="text-sm">{opt.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Essay Textarea */}
              {q.type === 'ESSAY' && (
                <div className="pt-2">
                  <textarea
                    rows={4}
                    placeholder="Tuliskan jawaban uraian Anda secara rinci di sini..."
                    value={answers[q.id] || ''}
                    onChange={(e) => handleSelectAnswer(q.id, e.target.value)}
                    className="w-full p-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}

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
    </div>
  );
}
