'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Calendar, HelpCircle, ArrowLeft, ArrowRight, Trophy, AlertTriangle, CheckCircle2, XCircle, Target, RotateCcw, KeyRound, Shield, ShieldAlert, Sparkles } from 'lucide-react';
import { startOrGetQuizAttempt } from '@/lib/actions/quiz';
import { StudentQuizClient } from './client';
import { Link } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';

export function StudentQuizLanding({ courseId, quiz, status }: { courseId: string; quiz: any; status: any }) {
  const t = useTranslations('studentQuiz');
  const locale = useLocale();
  const dateLocale = locale === 'id' ? 'id-ID' : 'en-US';

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
      setError(t('tokenRequiredError'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await startOrGetQuizAttempt(quiz.id, tokenInput.trim());
      setQuizData(data);
    } catch (err: any) {
      setError(err.message || t('failedStartQuiz'));
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
          <ArrowLeft className="h-4 w-4" /> {t('backToModules')}
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
              <div className="text-xs text-gray-500">{t('questionsUnit')}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-[#002446]">{quiz.duration || '∞'}</div>
              <div className="text-xs text-gray-500">{t('minutesUnit')}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-[#002446]">{status.maxAttempts === null ? '∞' : status.maxAttempts}</div>
              <div className="text-xs text-gray-500">{t('attemptsUnit')}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-[#002446]">{quiz.passingGrade ?? '-'}</div>
              <div className="text-xs text-gray-500">{t('passingGradeUnit')}</div>
            </div>
          </div>

          {quiz.deadline && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
              <Calendar className="h-4 w-4 text-amber-600" />
              {t('deadlineLabel')} <strong>{new Date(quiz.deadline).toLocaleString(dateLocale)}</strong>
            </div>
          )}

          {quiz.passingGrade && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
              <Target className="h-4 w-4 text-blue-600" />
              {t('passingGradeLabel')} <strong>{quiz.passingGrade}</strong>
            </div>
          )}

          {(quiz.isRemedial || status.isRemedial) && (
            <div className="flex items-start gap-3 p-3.5 bg-amber-500/10 border border-amber-300 rounded-lg text-amber-900 text-sm">
              <Sparkles className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold flex items-center gap-2">
                  <span>{t('remedialProgramTitle')}</span>
                  <Badge className="bg-amber-600 text-white hover:bg-amber-700 text-[10px] uppercase">{t('remedialBadge')}</Badge>
                </div>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  {t('remedialProgramDesc', {
                    forExam: status.parentQuiz?.title ? t('remedialForExam', { title: status.parentQuiz.title }) : '',
                    kkm: status.parentQuiz?.passingGrade || quiz.passingGrade || 75
                  })}
                </p>
              </div>
            </div>
          )}

          {status.isTargeted === false && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <div className="font-bold">{t('notRemedialCandidate')}</div>
                <div className="text-xs text-rose-700 mt-0.5">
                  {t('notRemedialDesc')}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Previous Attempts */}
      {status.submittedCount > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-bold text-[#002446] flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#FF8928]" /> {t('attemptHistory', { count: status.submittedCount })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {/* show best score and latest attempt info */}
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              {status.bestScore !== null && (
                <div>
                  <div className="text-xs text-gray-500">{t('bestScore')}</div>
                  <div className={`text-2xl font-bold ${status.passed === true ? 'text-green-700' : status.passed === false ? 'text-red-700' : 'text-[#002446]'}`}>
                    {status.bestScore}/100
                  </div>
                </div>
              )}
              {status.passed !== null && (
                <Badge className={status.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                  {status.passed ? t('passedBadge') : t('notPassedBadge')}
                </Badge>
              )}
              <div className="ml-auto text-right">
                <div className="text-xs text-gray-500">{t('attemptProgress')}</div>
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
              {t('lockdownTitle')}
            </div>
            <ul className="text-xs text-rose-700 space-y-1 list-disc pl-5">
              <li>{t('lockdownRule1')}</li>
              <li>{t('lockdownRule2')}</li>
              <li>
                {t('lockdownRule3', { count: maxTabSwitches })}
              </li>
              <li>{t('lockdownRule4')}</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Token Input Box */}
      {isRequireToken && !isInProgress && canAttempt && status.status !== 'EXPIRED' && (
        <Card className="border-2 border-[#002446]/20 bg-linear-to-b from-blue-50/50 to-white shadow-md p-5 text-center space-y-4">
          <div className="space-y-1">
            <Label htmlFor="cbtTokenInput" className="text-sm font-bold text-[#002446] flex items-center justify-center gap-2">
              <KeyRound className="h-4 w-4 text-[#FF8928]" /> {t('tokenBoxTitle')}
            </Label>
            <p className="text-xs text-gray-500">
              {t('tokenBoxDesc')}
            </p>
          </div>

          {/* Token Display Pill */}
          {quiz.token && (
            <div className="flex items-center justify-center gap-2">
              <div className="px-4 py-2 bg-blue-100/70 border border-blue-300 rounded-lg text-[#002446] font-mono text-xl font-extrabold tracking-widest select-all">
                {quiz.token}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTokenInput(quiz.token)}
                className="text-xs border-[#002446]/30 text-[#002446] hover:bg-[#002446] hover:text-white font-medium h-10"
              >
                {t('useTokenBtn')}
              </Button>
            </div>
          )}

          <div className="max-w-xs mx-auto pt-1">
            <Input
              id="cbtTokenInput"
              placeholder={quiz.token ? t('tokenPlaceholderWithToken', { token: quiz.token }) : t('tokenPlaceholder')}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
              maxLength={12}
              className="font-mono text-center text-lg font-bold tracking-widest uppercase h-11 bg-white border-2 border-gray-300 focus:border-[#002446]"
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
        {status.isTargeted === false ? (
          <Button disabled size="lg" className="bg-gray-300 text-gray-600 cursor-not-allowed px-12">
            {t('notRemedialCandidate')}
          </Button>
        ) : status.status === 'EXPIRED' ? (
          <Button disabled size="lg" className="bg-gray-300 text-gray-600 cursor-not-allowed px-12">
            {t('deadlinePassedBtn')}
          </Button>
        ) : !canAttempt ? (
          <Button disabled size="lg" className="bg-gray-300 text-gray-600 cursor-not-allowed px-12">
            {t('attemptsExhaustedBtn', { count: status.submittedCount, max: status.maxAttempts })}
          </Button>
        ) : (
          <Button
            onClick={handleStart}
            disabled={loading}
            size="lg"
            className={`px-12 text-lg font-bold ${isInProgress ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#FF8928] hover:bg-[#FF8928]/90'} text-white flex items-center gap-2`}
          >
            {loading ? t('preparingQuiz') : isInProgress ? t('continueQuiz') : status.submittedCount > 0 ? t('tryAgainAttempt', { count: status.submittedCount + 1 }) : t('startQuizBtn')}
            <ArrowRight className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
