'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
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
  const t = useTranslations('teacherQuizAttempts');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'id-ID';

  const router = useRouter();
  const { showAlert } = useDialog();

  const getDifficultyLabel = (label: string) => {
    if (label === 'Mudah') return t('difficultyMudah');
    if (label === 'Sedang') return t('difficultySedang');
    if (label === 'Sukar') return t('difficultySukar');
    return label;
  };

  const getDiscriminationLabel = (label: string) => {
    if (label === 'Sangat Baik') return t('discSangatBaik');
    if (label === 'Baik') return t('discBaik');
    if (label === 'Cukup') return t('discCukup');
    if (label === 'Jelek / Revisi') return t('discJelek');
    return label;
  };

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
      studentAnswer: ans.answer || `(${t('noAnswer')})`,
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
      await showAlert(t('essayScoreSavedSuccess'), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('essayScoreSavedFailed'), { type: 'error' });
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
      await showAlert(t('remedialSelectStudentWarning'), { type: 'warning' });
      return;
    }
    if (selectedQuestionIds.length === 0) {
      await showAlert(t('remedialSelectQuestionWarning'), { type: 'warning' });
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
      await showAlert(t('remedialSuccess'), { type: 'success' });
      router.refresh();
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('remedialFailed'), { type: 'error' });
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
            <h1 className="text-2xl font-bold text-[#002446]">{t('quizTitle', { title: data.quiz.title })}</h1>
          </div>
          <p className="text-sm text-gray-500 pl-10">
            {data.quiz.courseTitle} • {t('questionsCount', { count: data.questions.length })}{' '}
            {data.quiz.passingGrade !== undefined && data.quiz.passingGrade !== null && (
              <span className="text-blue-700 font-semibold">• {t('kkm', { score: data.quiz.passingGrade })}{' '}</span>
            )}
            {data.quiz.maxAttempts !== undefined && data.quiz.maxAttempts !== null && (
              <span className="text-purple-700 font-semibold">• {t('maxAttempts', { count: data.quiz.maxAttempts })}{' '}</span>
            )}
            {hasEssay && <span className="text-amber-700 font-semibold">{t('containsEssay')}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/teacher/course/${data.quiz.courseId}/quiz-attempts/${data.quiz.id}/proctor`}>
            <Button className="bg-[#002446] hover:bg-[#001b33] text-white flex items-center gap-1.5 font-bold">
              <Shield className="h-4 w-4 text-emerald-400" />
              {t('liveProctoring')}
            </Button>
          </Link>
          <Link href={`/teacher/course/${data.quiz.courseId}/gradebook`}>
            <Button variant="outline" className="border-[#002446] text-[#002446] hover:bg-gray-100">
              {t('viewGradebook')}
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
          <span>{t('tabAttempts')}</span>
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
          <span>{t('tabAnalysis')}</span>
          {analysisData && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 font-semibold">
              {t('itemsCount', { count: analysisData.questions.length })}
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
          <span>{t('tabRemedial')}</span>
          {remedialData && remedialData.remedialStudents.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-900 font-semibold">
              {t('studentsCount', { count: remedialData.remedialStudents.length })}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'attempts' && (
        <Card className="bg-white shadow-sm border">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg font-bold text-[#002446]">
              {t('attemptsListTitle', { count: attempts.length })}
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-600 text-xs uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">{t('thNo')}</th>
                    <th className="py-3 px-4">{t('thStudentName')}</th>
                    <th className="py-3 px-4 text-center">{t('thNis')}</th>
                    <th className="py-3 px-4">{t('thSubmittedAt')}</th>
                    <th className="py-3 px-4 text-center">{t('thFinalScore')}</th>
                    <th className="py-3 px-4 text-center">{t('thStatus')}</th>
                    <th className="py-3 px-4 text-right">{t('thAction')}</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {attempts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400">
                        {t('noAttempts')}
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
                              <div>{new Date(att.submittedAt).toLocaleDateString(dateLocale)}</div>
                              <div className="text-[11px] text-gray-400">
                                {new Date(att.submittedAt).toLocaleTimeString(dateLocale, {
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
                                <CheckCircle2 className="h-3.5 w-3.5" /> {t('statusGraded')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                                <Clock className="h-3.5 w-3.5" /> {t('statusNeedsGrading')}
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
                            {t('checkAnswers')}
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

      {activeTab === 'analysis' && (
        <div className="space-y-6">
          {!analysisData || analysisData.totalParticipants === 0 ? (
            <Card className="p-8 text-center text-gray-500 bg-white border">
              <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <div className="text-lg font-bold text-[#002446]">{t('notEnoughDataTitle')}</div>
              <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                {t('notEnoughDataDesc')}
              </p>
            </Card>
          ) : (
            <>
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border border-gray-200 dark:border-gray-800 shadow-xs bg-white dark:bg-gray-900">
                  <CardContent className="p-4 space-y-1">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('totalParticipants')}</div>
                    <div className="text-2xl font-black text-[#002446] dark:text-white">
                      {analysisData.totalParticipants} <span className="text-xs font-normal text-gray-500">{t('studentsSuffix')}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-gray-200 dark:border-gray-800 shadow-xs bg-white dark:bg-gray-900">
                  <CardContent className="p-4 space-y-1">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('averageScore')}</div>
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {analysisData.averageScore} <span className="text-xs font-normal text-gray-500">/ 100</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-gray-200 dark:border-gray-800 shadow-xs bg-white dark:bg-gray-900">
                  <CardContent className="p-4 space-y-1">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('scoreRange')}</div>
                    <div className="text-2xl font-black text-[#002446] dark:text-white">
                      {analysisData.lowestScore} - {analysisData.highestScore}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-gray-200 dark:border-gray-800 shadow-xs bg-white dark:bg-gray-900">
                  <CardContent className="p-4 space-y-1">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('kkmPassing', { passingGrade })}</div>
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
                  <span className="font-bold text-[#002446] block mb-1">{t('difficultyGuidelines')}</span>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-emerald-100 text-emerald-800 border-none">{t('easyLabel')}</Badge>
                    <Badge className="bg-blue-100 text-blue-800 border-none">{t('mediumLabel')}</Badge>
                    <Badge className="bg-rose-100 text-rose-800 border-none">{t('hardLabel')}</Badge>
                  </div>
                </div>
                <div>
                  <span className="font-bold text-[#002446] block mb-1">{t('discriminationGuidelines')}</span>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-emerald-100 text-emerald-800 border-none">{t('veryGoodLabel')}</Badge>
                    <Badge className="bg-blue-100 text-blue-800 border-none">{t('goodLabel')}</Badge>
                    <Badge className="bg-amber-100 text-amber-800 border-none">{t('fairLabel')}</Badge>
                    <Badge className="bg-rose-100 text-rose-800 border-none">{t('poorLabel')}</Badge>
                  </div>
                </div>
              </div>

              {/* Questions Analysis Table */}
              <Card className="bg-white shadow-sm border overflow-hidden">
                <CardHeader className="pb-3 border-b bg-gray-50/50">
                  <CardTitle className="text-base font-bold text-[#002446] flex items-center justify-between">
                    <span>{t('paramListTitle', { count: analysisData.questions.length })}</span>
                    <span className="text-xs text-gray-500 font-normal">{t('paramListSubtitle')}</span>
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
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    q.type === 'MULTIPLE_CHOICE_COMPLEX'
                                      ? 'border-indigo-300 text-indigo-700 bg-indigo-50 font-semibold'
                                      : ''
                                  }`}
                                >
                                  {q.type === 'MULTIPLE_CHOICE'
                                    ? t('mcType')
                                    : q.type === 'MULTIPLE_CHOICE_COMPLEX'
                                    ? t('mccType')
                                    : t('essayType')}
                                </Badge>
                                <span>•</span>
                                <span>{t('points', { count: q.points })}</span>
                                <span>•</span>
                                <span className="text-emerald-700 font-medium">{t('correctCount', { count: q.correctCount })}</span>
                                <span>•</span>
                                <span className="text-rose-700 font-medium">{t('incorrectCount', { count: q.incorrectCount })}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                            {/* Difficulty */}
                            <div className="text-right">
                              <div className="text-[11px] text-gray-400">{t('difficultyP')}</div>
                              <div className="flex items-center gap-1.5 justify-end">
                                <span className="text-xs font-mono font-bold text-gray-700">{q.difficultyIndex}</span>
                                <Badge className={`${difficultyBadgeColor} text-[10px]`}>{getDifficultyLabel(q.difficultyLabel)}</Badge>
                              </div>
                            </div>

                            {/* Discrimination */}
                            <div className="text-right">
                              <div className="text-[11px] text-gray-400">{t('discriminationD')}</div>
                              <div className="flex items-center gap-1.5 justify-end">
                                <span className="text-xs font-mono font-bold text-gray-700">{q.discriminationIndex}</span>
                                <Badge className={`${discriminationBadgeColor} text-[10px]`}>{getDiscriminationLabel(q.discriminationLabel)}</Badge>
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
                              <span>{t('evaluationRecommendation')}</span>
                              <span className="font-medium text-gray-700">{q.recommendation}</span>
                            </div>

                            {(q.type === 'MULTIPLE_CHOICE' || q.type === 'MULTIPLE_CHOICE_COMPLEX') && q.optionsStats.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                  {t('distractorEfficiency')}
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
                                              <Badge className="bg-emerald-600 text-white text-[10px]">{t('keyBadge')}</Badge>
                                            )}
                                            {isDysfunctional && (
                                              <Badge className="bg-rose-600 text-white text-[10px]">{t('passiveDistractor')}</Badge>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2">
                                          <span>{t('chosenBy', { count: opt.count })}</span>
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
                                <div className="font-bold text-[#002446]">{t('essayStats')}</div>
                                <div className="text-gray-600">
                                  {t('essayStatsDesc', {
                                    avg: q.essayScoresSummary.averageScore,
                                    max: q.points,
                                    high: q.essayScoresSummary.highestScore,
                                    low: q.essayScoresSummary.lowestScore,
                                  })}
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

      {activeTab === 'remedial' && (
        <div className="space-y-6">
          {/* Header Action Banner */}
          <div className="p-5 bg-[#002446] dark:bg-[#0a1f36] border border-brand-900/20 dark:border-white/10 text-white rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-[#FF8928]" />
                <h2 className="text-xl font-bold">{t('remedialProgramTitle')}</h2>
              </div>
              <p className="text-xs text-white/80 max-w-xl">
                {t('remedialProgramDesc', { passingGrade })}
              </p>
            </div>

            <Button
              onClick={() => setIsRemedialModalOpen(true)}
              disabled={!remedialData || remedialData.remedialStudents.length === 0}
              className="bg-[#FF8928] hover:bg-[#ff7b10] text-white font-bold px-6 shrink-0 flex items-center gap-2 shadow-md"
            >
              <Sparkles className="h-4 w-4" />
              {t('createRemedialQuiz')}
            </Button>
          </div>

          {/* Remedial Students List */}
          <Card className="bg-white shadow-sm border">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-[#002446] flex items-center gap-2">
                <User className="h-5 w-5 text-rose-600" />
                {t('underKkmStudents', { count: remedialData?.remedialStudents.length || 0 })}
              </CardTitle>
              <Badge variant="outline" className="text-xs font-semibold">
                {t('kkmThreshold', { kkm: passingGrade })}
              </Badge>
            </CardHeader>

            <CardContent className="p-0">
              {!remedialData || remedialData.remedialStudents.length === 0 ? (
                <div className="p-8 text-center text-emerald-700 bg-emerald-50/50">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
                  <div className="font-bold text-base">{t('allReachedKkmTitle')}</div>
                  <p className="text-xs text-emerald-600 mt-1">
                    {t('allReachedKkmDesc', { passingGrade })}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b text-gray-600 text-xs uppercase tracking-wider">
                        <th className="py-3 px-4 w-12 text-center">{t('thNo')}</th>
                        <th className="py-3 px-4">{t('thStudentName')}</th>
                        <th className="py-3 px-4 text-center">{t('thNis')}</th>
                        <th className="py-3 px-4 text-center">{t('thBestScore')}</th>
                        <th className="py-3 px-4 text-center">{t('thWrongQuestions')}</th>
                        <th className="py-3 px-4">{t('thLastSubmitted')}</th>
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
                              {t('wrongCount', { count: st.wrongQuestionIds.length })}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-gray-500">
                            {st.submittedAt ? new Date(st.submittedAt).toLocaleDateString(dateLocale) : '-'}
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
                  {t('mostFailedTitle')}
                </CardTitle>
                <p className="text-xs text-gray-500">
                  {t('mostFailedDesc')}
                </p>
              </CardHeader>

              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {remedialData.mostFailedQuestions.slice(0, 6).map((q, idx) => (
                    <div key={q.questionId} className="p-3.5 rounded-lg border bg-amber-50/40 border-amber-200 text-xs space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-amber-900">{t('priorityRank', { rank: idx + 1 })}</span>
                        <Badge className="bg-rose-600 text-white text-[10px]">
                          {t('failBadge', { count: q.failCount, percent: q.failPercentage })}
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
                  {t('existingRemedialsTitle', { count: remedialData.existingRemedials.length })}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <div className="divide-y divide-gray-100">
                  {remedialData.existingRemedials.map((r) => (
                    <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                          <span>{r.title}</span>
                          <Badge className="bg-amber-100 text-amber-900 text-[10px]">{t('remedialBadge')}</Badge>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {t('remedialHistorySubtitle', {
                            date: new Date(r.createdAt).toLocaleDateString(dateLocale),
                            questions: r._count.questions,
                            attempts: r._count.attempts,
                          })}
                        </div>
                      </div>

                      <Link href={`/teacher/course/${data.quiz.courseId}/quiz-attempts/${r.id}`}>
                        <Button variant="outline" size="sm" className="text-xs flex items-center gap-1">
                          <span>{t('viewHistory')}</span>
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
              {t('modalRemedialTitle')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateRemedialQuiz} className="space-y-5 py-2">
            <div className="space-y-3">
              <div>
                <Label htmlFor="remTitle" className="text-xs font-bold text-gray-700">{t('remedialQuizTitleLabel')}</Label>
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
                  <Label htmlFor="remDuration" className="text-xs font-bold text-gray-700">{t('durationMinutesLabel')}</Label>
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
                  <Label className="text-xs font-bold text-gray-700">{t('kkmMaxCapLabel')}</Label>
                  <Input
                    disabled
                    value={t('kkmMatchNote', { kkm: passingGrade })}
                    className="mt-1 bg-gray-100 text-gray-600 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Target Students Selection */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-[#002446] uppercase tracking-wider">
                  {t('targetStudentsLabel', {
                    selected: selectedStudentIds.length,
                    total: remedialData?.remedialStudents.length || 0,
                  })}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleAllStudents}
                  className="text-xs text-blue-700 hover:text-blue-900 h-7 px-2"
                >
                  {selectedStudentIds.length === (remedialData?.remedialStudents.length || 0)
                    ? t('deselectAll')
                    : t('selectAll')}
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
                        {t('originalScoreBadge', { score: st.bestScore })}
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
                  {t('selectQuestionsLabel', {
                    selected: selectedQuestionIds.length,
                    total: data.questions.length,
                  })}
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectFailedQuestions}
                    className="text-xs text-amber-800 border-amber-300 bg-amber-50 hover:bg-amber-100 h-7 px-2"
                  >
                    {t('onlyFailedQuestions')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllQuestions}
                    className="text-xs text-blue-700 hover:text-blue-900 h-7 px-2"
                  >
                    {selectedQuestionIds.length === data.questions.length ? t('deselectAllQuestions') : t('allQuestions')}
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
                          <span className="font-bold text-xs text-[#002446]">{t('questionItemNum', { num: idx + 1 })}</span>
                          {isMostFailed && (
                            <Badge className="bg-amber-100 text-amber-900 text-[9px] border border-amber-300">
                              {t('oftenWrong')}
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
                {t('remedialNotice')}
              </span>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRemedialModalOpen(false)}
                disabled={isGeneratingRemedial}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isGeneratingRemedial}
                className="bg-[#FF8928] hover:bg-[#ff7b10] text-white font-bold"
              >
                {isGeneratingRemedial ? t('creatingQuiz') : t('publishRemedialQuiz')}
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
                      {t('answerSheetTitle', { name: selectedAttempt.user.name })}
                    </DialogTitle>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('answerSheetSubtitle', {
                        nis: selectedAttempt.user.nis || '-',
                        date: selectedAttempt.submittedAt
                          ? new Date(selectedAttempt.submittedAt).toLocaleString(dateLocale)
                          : '-',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">{t('finalScore')}</div>
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
                              ({isEssay ? t('essayTypeLabel') : t('mcType')} • {t('weightPoints', { points: ans.question.points })})
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
                                {t('ungraded')}
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
                        <span className="text-xs text-gray-500 font-bold block mb-1">{t('studentAnswerLabel')}</span>
                        <p className="text-gray-800 whitespace-pre-wrap">
                          {ans.answer ? ans.answer : <span className="italic text-gray-400">{t('noAnswer')}</span>}
                        </p>
                      </div>

                      {/* Teacher Note & Essay Grade Action */}
                      {isEssay && (
                        <div className="flex items-center justify-between pt-1">
                          <div className="text-xs text-gray-500">
                            {ans.teacherNote ? (
                              <span>
                                <strong>{t('teacherNoteLabel')}</strong> {ans.teacherNote}
                              </span>
                            ) : (
                              <span className="italic">{t('noNoteYet')}</span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEssayGrade(ans)}
                            className="text-xs border-[#002446] text-[#002446] hover:bg-[#002446] hover:text-white"
                          >
                            {t('gradeEssayBtn')}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedAttempt(null)}>
                  {t('close')}
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
              {t('gradeEssayModalTitle')}
            </DialogTitle>
          </DialogHeader>

          {gradingAnswer && (
            <form onSubmit={handleSaveEssayGrade} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500">{t('questionLabel')}</Label>
                <div className="p-2.5 bg-gray-50 rounded border text-sm text-gray-800">
                  {gradingAnswer.questionText}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500">{t('studentAnswerLabel')}</Label>
                <div className="p-2.5 bg-gray-50 rounded border text-sm text-gray-800 whitespace-pre-wrap">
                  {gradingAnswer.studentAnswer}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="essayScore">
                    {t('itemScoreLabel', { max: gradingAnswer.maxPoints })}
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
                  <Label htmlFor="essayNote">{t('noteLabel')}</Label>
                  <Textarea
                    id="essayNote"
                    rows={3}
                    placeholder={t('notePlaceholder')}
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
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={loading} className="bg-[#FF8928] text-white font-bold">
                  {loading ? t('saving') : t('saveGrade')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
