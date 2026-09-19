'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  FileDown,
  Video,
  HelpCircle,
  ClipboardList,
  Clock,
  Calendar,
  Layers,
  ArrowRight,
  CheckCircle2,
  CalendarCheck,
  MessageSquare,
  Megaphone,
  Pin,
  Trophy,
  Sparkles,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LeaderboardModal } from '@/components/course/leaderboard-modal';
import { markLessonCompleted } from '@/lib/actions/gamification';
import { useTranslations, useLocale } from 'next-intl';

export function StudentCourseModulesClient({
  course,
  modules,
  quizStatusMap,
  pinnedAnnouncement,
  activeSession,
  completedLessonIds = [],
}: {
  course: any;
  modules: any[];
  quizStatusMap: Record<string, any>;
  pinnedAnnouncement?: any | null;
  activeSession?: any | null;
  completedLessonIds?: string[];
}) {
  const t = useTranslations('studentModules');
  const locale = useLocale();

  const [completedIds, setCompletedIds] = useState<string[]>(completedLessonIds);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const handleMarkLesson = async (contentId: string) => {
    if (completedIds.includes(contentId)) return;
    setMarkingId(contentId);
    try {
      const res = await markLessonCompleted(contentId, course.id);
      if (res.success) {
        setCompletedIds((prev) => [...prev, contentId]);
      }
    } catch (err) {
      console.error('Failed to mark lesson completed:', err);
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Quick Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/student/course/${course.id}/attendance`}>
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex items-center gap-1.5 border-emerald-600 text-emerald-700 hover:bg-emerald-50"
            >
              <CalendarCheck className="h-4 w-4 text-emerald-600" />
              {t('attendanceBtn')}
            </Button>
          </Link>

          <Link href={`/student/course/${course.id}/forum`}>
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex items-center gap-1.5 border-[#002446] text-[#002446] hover:bg-blue-50"
            >
              <MessageSquare className="h-4 w-4 text-[#002446]" />
              {t('forumBtn')}
            </Button>
          </Link>

          <Link href="/student/grades">
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex items-center gap-1.5 text-gray-600 hover:bg-gray-50"
            >
              <Trophy className="h-4 w-4 text-[#FF8928]" />
              {t('gradebookBtn')}
            </Button>
          </Link>

          {/* Class Leaderboard Modal Trigger */}
          <LeaderboardModal courseId={course.id} />
        </div>

        <span className="text-xs text-gray-500 font-medium">
          {t('modulesAvailable', { count: modules.length })}
        </span>
      </div>

      {/* Active Attendance Session Banner */}
      {activeSession && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-white to-blue-50 border-2 border-emerald-500/70 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-lg shadow-sm">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  {t('activeSessionBadge')}
                </span>
              </div>
              <h4 className="text-sm font-bold text-[#002446] mt-0.5">
                {activeSession.title}
              </h4>
              <p className="text-xs text-gray-500">
                {t('activeSessionDesc')}
              </p>
            </div>
          </div>

          <Link href={`/student/course/${course.id}/attendance`}>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 whitespace-nowrap"
            >
              {t('checkinNowBtn')} <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      )}

      {/* Pinned Announcement Banner */}
      {pinnedAnnouncement && (
        <div className="p-4 rounded-xl bg-amber-50/90 border border-[#FF8928]/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#FF8928] text-white rounded-lg mt-0.5">
              <Megaphone className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Badge className="bg-[#FF8928] text-white text-[10px] py-0 px-1.5 flex items-center gap-1">
                  <Pin className="h-2.5 w-2.5 fill-white" /> {t('pinnedAnnouncementBadge')}
                </Badge>
                <span className="text-xs text-gray-500">
                  {new Date(pinnedAnnouncement.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
              <h4 className="text-sm font-bold text-[#002446]">
                {pinnedAnnouncement.title}
              </h4>
              <p className="text-xs text-gray-700 line-clamp-1">
                {pinnedAnnouncement.content}
              </p>
            </div>
          </div>

          <Link href={`/student/course/${course.id}/forum`}>
            <Button
              variant="outline"
              size="sm"
              className="border-[#FF8928] text-[#FF8928] hover:bg-amber-100/50 text-xs font-semibold whitespace-nowrap"
            >
              {t('viewAnnouncementBtn')}
            </Button>
          </Link>
        </div>
      )}

      {modules.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="space-y-3">
            <Layers className="h-12 w-12 mx-auto text-gray-300" />
            <h3 className="text-lg font-bold text-[#002446]">{t('emptyModulesTitle')}</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              {t('emptyModulesDesc')}
            </p>
          </CardContent>
        </Card>
      ) : (
        modules.map((mod, index) => (
          <Card key={mod.id} className="border border-gray-200 overflow-hidden shadow-sm bg-white">
            <CardHeader className="bg-gray-50/80 border-b py-3 px-5 flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center h-8 w-8 rounded-full bg-[#002446] text-white text-sm font-bold">
                  {index + 1}
                </span>
                <CardTitle className="text-lg font-bold text-[#002446]">
                  {mod.title}
                </CardTitle>
              </div>

              <Link href={`/student/course/${course.id}/forum?moduleId=${mod.id}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-gray-600 hover:text-[#002446] flex items-center gap-1"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-[#FF8928]" />
                  <span className="hidden sm:inline">{t('askInForumBtn')}</span>
                </Button>
              </Link>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* 1. Konten Materi */}
              {mod.contents.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-blue-600" /> {t('materialsHeading')}
                  </h4>

                  <div className="space-y-4">
                    {mod.contents.map((cnt: any) => (
                      <div
                        key={cnt.id}
                        className="p-4 rounded-lg border border-gray-100 bg-gray-50/50 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {cnt.type === 'TEXT' ? (
                              <FileText className="h-5 w-5 text-blue-600" />
                            ) : cnt.type === 'FILE' ? (
                              <FileDown className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <Video className="h-5 w-5 text-red-600" />
                            )}
                            <h5 className="font-bold text-base text-[#002446]">
                              {cnt.title}
                            </h5>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {cnt.type}
                          </Badge>
                        </div>

                        {/* Rich Text Body */}
                        {cnt.type === 'TEXT' && cnt.body && (
                          <div
                            className="prose max-w-none text-sm text-gray-700 bg-white p-4 rounded-md border border-gray-100 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: cnt.body }}
                          />
                        )}

                        {/* File Download */}
                        {cnt.type === 'FILE' && cnt.fileUrl && (
                          <div className="flex items-center justify-between p-3 bg-white border rounded-md">
                            <div className="flex items-center gap-2">
                              <FileDown className="h-5 w-5 text-emerald-600" />
                              <span className="text-sm font-medium text-gray-800">
                                {cnt.fileName || t('docFile')}
                              </span>
                            </div>
                            <a
                              href={cnt.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#002446] text-white px-3 py-1.5 rounded hover:bg-[#002446]/90 transition-colors"
                            >
                              <FileDown className="h-3.5 w-3.5" /> {t('downloadDoc')}
                            </a>
                          </div>
                        )}

                        {/* Video */}
                        {cnt.type === 'VIDEO' && cnt.fileUrl && (
                          <div className="p-3 bg-white border rounded-md">
                            {cnt.fileUrl.includes('youtube.com') || cnt.fileUrl.includes('youtu.be') ? (
                              <div className="aspect-video w-full max-w-2xl rounded overflow-hidden">
                                <iframe
                                  src={cnt.fileUrl.replace('watch?v=', 'embed/')}
                                  title={cnt.title}
                                  className="w-full h-full"
                                  allowFullScreen
                                />
                              </div>
                            ) : (
                              <video
                                src={cnt.fileUrl}
                                controls
                                className="w-full max-w-2xl rounded"
                              />
                            )}
                          </div>
                        )}

                        {/* Mark completed button / badge */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/60">
                          <span className="text-[11px] text-gray-500">
                            {t('learningActivity')}
                          </span>
                          {completedIds.includes(cnt.id) ? (
                            <Badge className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 flex items-center gap-1 text-xs">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              {t('completedBadge')}
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkLesson(cnt.id)}
                              disabled={markingId === cnt.id}
                              className="text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950/30 flex items-center gap-1.5 h-8"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              {markingId === cnt.id ? t('saving') : t('markCompleteBtn')}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Kuis */}
              {mod.quizzes.length > 0 && (
                <div className="space-y-3 pt-3 border-t">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4 text-[#FF8928]" /> {t('quizzesHeading')}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mod.quizzes.map((quiz: any) => {
                      const status = quizStatusMap?.[quiz.id];
                      const statusType = status?.status || 'NOT_STARTED';
                      const canAttempt = statusType !== 'EXPIRED' && (
                        statusType !== 'COMPLETED' || 
                        status?.maxAttempts === null || 
                        (status?.submittedCount || 0) < (status?.maxAttempts || 1)
                      );
                      const isInProgress = statusType === 'IN_PROGRESS';
                      
                      return (
                        <Card key={quiz.id} className={`border ${statusType === 'EXPIRED' ? 'border-red-200 bg-red-50/30' : statusType === 'COMPLETED' ? 'border-green-200 bg-green-50/20' : 'border-amber-200 bg-amber-50/30'} hover:shadow-md transition-all`}>
                          <CardHeader className="p-4 pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base font-bold text-[#002446] flex items-center gap-2">
                                <span>{quiz.title}</span>
                                {quiz.isRemedial && (
                                  <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-900 border border-amber-300">
                                    {t('remedialBadge')}
                                  </Badge>
                                )}
                              </CardTitle>
                              {/* Status Badge */}
                              {statusType === 'NOT_STARTED' && (
                                <Badge variant="outline" className="text-xs text-gray-500 border-gray-300">{t('statusNotStarted')}</Badge>
                              )}
                              {statusType === 'IN_PROGRESS' && (
                                <Badge className="text-xs bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">{t('statusInProgress')}</Badge>
                              )}
                              {statusType === 'COMPLETED' && status?.passed === true && (
                                <Badge className="text-xs bg-green-100 text-green-800 border border-green-300">{t('statusPassed')}</Badge>
                              )}
                              {statusType === 'COMPLETED' && status?.passed === false && (
                                <Badge className="text-xs bg-red-100 text-red-800 border border-red-300">{t('statusFailed')}</Badge>
                              )}
                              {statusType === 'COMPLETED' && status?.passed === null && (
                                <Badge className="text-xs bg-green-100 text-green-800 border border-green-300">{t('statusCompleted')}</Badge>
                              )}
                              {statusType === 'EXPIRED' && (
                                <Badge className="text-xs bg-red-100 text-red-800 border border-red-300">{t('statusExpired')}</Badge>
                              )}
                            </div>
                            {quiz.description && (
                              <p className="text-xs text-gray-600 line-clamp-2">{quiz.description}</p>
                            )}
                          </CardHeader>
                          <CardContent className="p-4 pt-0 space-y-3">
                            <div className="flex items-center gap-4 text-xs text-gray-600 pt-2 border-t border-gray-100">
                              <span>{t('questionsCount', { count: quiz._count.questions })}</span>
                              {quiz.duration && (
                                <span className="flex items-center gap-1 font-medium text-[#002446]">
                                  <Clock className="h-3.5 w-3.5 text-[#FF8928]" />
                                  {t('durationMinutes', { count: quiz.duration })}
                                </span>
                              )}
                              {quiz.deadline && (
                                <span className="flex items-center gap-1 text-gray-500">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {new Date(quiz.deadline).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID')}
                                </span>
                              )}
                            </div>

                            {/* Score & Attempt Info for completed quizzes */}
                            {statusType === 'COMPLETED' && status && (
                              <div className="flex items-center gap-3 text-xs bg-white rounded-md p-2 border">
                                {status.bestScore !== null && (
                                  <span className="font-bold text-[#002446]">
                                    {t('bestScore')}{' '}
                                    <span className={status.passed === true ? 'text-green-700' : status.passed === false ? 'text-red-700' : 'text-[#FF8928]'}>
                                      {status.bestScore}/100
                                    </span>
                                  </span>
                                )}
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-600">
                                  {t('attempts')} {status.submittedCount}/{status.maxAttempts === null ? '∞' : status.maxAttempts}
                                </span>
                              </div>
                            )}

                            {/* Action Button */}
                            {status?.isTargeted === false ? (
                              <Button size="sm" disabled className="w-full bg-gray-200 text-gray-500 cursor-not-allowed">
                                {t('notRemedialParticipant')}
                              </Button>
                            ) : statusType === 'EXPIRED' ? (
                              <Button size="sm" disabled className="w-full bg-gray-200 text-gray-500 cursor-not-allowed">
                                {t('expiredBtn')}
                              </Button>
                            ) : !canAttempt ? (
                              <Button size="sm" disabled className="w-full bg-gray-200 text-gray-500 cursor-not-allowed">
                                {t('attemptsExhausted', { count: status?.submittedCount, max: status?.maxAttempts })}
                              </Button>
                            ) : (
                              <Link href={`/student/course/${course.id}/quiz/${quiz.id}`} className="block">
                                <Button
                                  size="sm"
                                  className={`w-full flex items-center justify-center gap-1.5 ${
                                    isInProgress
                                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                      : statusType === 'COMPLETED'
                                      ? 'bg-white border border-[#002446] text-[#002446] hover:bg-[#002446] hover:text-white'
                                      : 'bg-[#FF8928] hover:bg-[#FF8928]/90 text-white'
                                  }`}
                                >
                                  {isInProgress
                                    ? t('continueQuizBtn')
                                    : statusType === 'COMPLETED'
                                    ? t('retryQuizBtn', { count: status?.submittedCount, max: status?.maxAttempts === null ? '∞' : status?.maxAttempts })
                                    : t('startQuizBtn')}
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Penugasan */}
              {mod.assignments.length > 0 && (
                <div className="space-y-3 pt-3 border-t">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardList className="h-4 w-4 text-purple-600" /> {t('assignmentsHeading')}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mod.assignments.map((assign: any) => (
                      <Card
                        key={assign.id}
                        className="border border-purple-200 bg-purple-50/30 hover:border-purple-300 transition-colors"
                      >
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-base font-bold text-[#002446]">
                            {assign.title}
                          </CardTitle>
                          {assign.description && (
                            <p className="text-xs text-gray-600 line-clamp-2">
                              {assign.description}
                            </p>
                          )}
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-3">
                          <div className="flex items-center gap-4 text-xs text-gray-600 pt-2 border-t border-purple-100">
                            <span>{t('maxScore', { score: assign.maxScore })}</span>
                            {assign.deadline && (
                              <span className="flex items-center gap-1 text-purple-700 font-medium">
                                <Calendar className="h-3.5 w-3.5" />
                                {t('deadline', { date: new Date(assign.deadline).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID') })}
                              </span>
                            )}
                          </div>

                          <Link
                            href={`/student/course/${course.id}/assignment/${assign.id}`}
                            className="block"
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full border-purple-400 text-purple-800 hover:bg-purple-600 hover:text-white flex items-center justify-center gap-1.5"
                            >
                              {t('submitAssignmentBtn')} <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
