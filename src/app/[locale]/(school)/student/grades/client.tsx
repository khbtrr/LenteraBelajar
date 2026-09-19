'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, CheckCircle2, Clock, HelpCircle, FileText, ChevronRight, MessageSquareQuote } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

interface StudentGradesClientProps {
  courses: Array<{
    courseId: string;
    courseTitle: string;
    teacherName: string;
    academicYear: string;
    average: number | null;
    quizzes: Array<{
      id: string;
      title: string;
      score: number | null;
      isGraded: boolean;
      submittedAt: Date | null;
    }>;
    assignments: Array<{
      id: string;
      title: string;
      maxScore: number;
      score: number | null;
      teacherNote: string | null;
      submittedAt: Date | null;
      gradedAt: Date | null;
    }>;
  }>;
}

export function StudentGradesClient({ courses }: StudentGradesClientProps) {
  const t = useTranslations('studentGrades');
  const locale = useLocale();
  const dateLocale = locale === 'id' ? 'id-ID' : 'en-US';

  const [activeCourseId, setActiveCourseId] = useState<string>(courses[0]?.courseId || '');

  if (courses.length === 0) {
    return (
      <Card className="text-center py-16 bg-white">
        <CardContent className="space-y-4">
          <BookOpen className="h-16 w-16 mx-auto text-gray-300" />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[#002446]">{t('noCoursesTitle')}</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              {t('noCoursesDesc')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedCourse = courses.find((c) => c.courseId === activeCourseId) || courses[0];

  return (
    <div className="space-y-6">
      {/* Course Selector Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {courses.map((c) => {
          const isActive = c.courseId === selectedCourse.courseId;
          return (
            <Button
              key={c.courseId}
              variant={isActive ? 'default' : 'outline'}
              onClick={() => setActiveCourseId(c.courseId)}
              className={`rounded-full text-xs font-semibold shrink-0 ${
                isActive
                  ? 'bg-[#002446] text-white hover:bg-[#002446]/90'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {c.courseTitle}
              {c.average !== null && (
                <span
                  className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive ? 'bg-amber-400 text-gray-900 font-bold' : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {c.average}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {/* Selected Course Overview */}
      <div className="bg-white rounded-xl p-5 border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#002446]">{selectedCourse.courseTitle}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('teacherLabel', { teacher: selectedCourse.teacherName, year: selectedCourse.academicYear })}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-amber-50 px-4 py-2.5 rounded-lg border border-amber-200/80">
          <span className="text-xs font-medium text-amber-900">{t('averageGrade')}</span>
          <span className="text-2xl font-bold text-[#FF8928]">
            {selectedCourse.average !== null ? selectedCourse.average : '-'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kuis Section */}
        <Card className="bg-white shadow-sm border">
          <CardHeader className="pb-3 border-b bg-blue-50/30">
            <CardTitle className="text-base font-bold text-[#002446] flex items-center justify-between">
              <span>{t('quizGradesTitle', { count: selectedCourse.quizzes.length })}</span>
              <HelpCircle className="h-4 w-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {selectedCourse.quizzes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">{t('noQuizzes')}</p>
            ) : (
              selectedCourse.quizzes.map((q) => (
                <div
                  key={q.id}
                  className="p-3.5 rounded-lg border bg-gray-50/60 flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-sm text-gray-900">{q.title}</div>
                    <div className="text-xs text-gray-500">
                      {q.submittedAt ? (
                        <span className="flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> {t('submittedOn', { date: new Date(q.submittedAt).toLocaleDateString(dateLocale) })}
                        </span>
                      ) : (
                        <span className="text-amber-700 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {t('notAttemptedYet')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {q.score !== null ? (
                      <div>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                            q.score >= 75
                              ? 'bg-emerald-100 text-emerald-800'
                              : q.score >= 60
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {q.score} / 100
                        </span>
                        {!q.isGraded && (
                          <div className="text-[10px] text-amber-600 mt-1">{t('essayGradingInProgress')}</div>
                        )}
                      </div>
                    ) : q.submittedAt ? (
                      <span className="text-xs text-amber-600 font-medium">{t('beingGraded')}</span>
                    ) : (
                      <Link href={`/student/course/${selectedCourse.courseId}/quiz/${q.id}`}>
                        <Button size="sm" className="bg-[#002446] text-white text-xs h-7">
                          {t('attemptQuizBtn')}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Penugasan Section */}
        <Card className="bg-white shadow-sm border">
          <CardHeader className="pb-3 border-b bg-purple-50/30">
            <CardTitle className="text-base font-bold text-[#002446] flex items-center justify-between">
              <span>{t('assignmentGradesTitle', { count: selectedCourse.assignments.length })}</span>
              <FileText className="h-4 w-4 text-purple-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {selectedCourse.assignments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">{t('noAssignments')}</p>
            ) : (
              selectedCourse.assignments.map((a) => (
                <div
                  key={a.id}
                  className="p-3.5 rounded-lg border bg-gray-50/60 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-sm text-gray-900">{a.title}</div>
                      <div className="text-xs text-gray-500">
                        {a.submittedAt ? (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {t('submittedOn', { date: new Date(a.submittedAt).toLocaleDateString(dateLocale) })}
                          </span>
                        ) : (
                          <span className="text-amber-700 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {t('notSubmittedYet')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {a.score !== null ? (
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                            a.score >= 75
                              ? 'bg-emerald-100 text-emerald-800'
                              : a.score >= 60
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {a.score} / {a.maxScore}
                        </span>
                      ) : a.submittedAt ? (
                        <span className="text-xs text-amber-600 font-medium">{t('waitingTeacherScore')}</span>
                      ) : (
                        <Link href={`/student/course/${selectedCourse.courseId}/assignment/${a.id}`}>
                          <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-7">
                            {t('submitAssignmentBtn')}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Feedback Guru */}
                  {a.teacherNote && (
                    <div className="text-xs text-amber-900 bg-amber-50 p-2.5 rounded border border-amber-200/80 flex items-start gap-2">
                      <MessageSquareQuote className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <strong>{t('teacherNoteLabel')}</strong> {a.teacherNote}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
