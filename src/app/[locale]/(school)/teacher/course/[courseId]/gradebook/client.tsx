'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { CourseGradebookData } from '@/lib/actions/grade';
import { exportToExcel, exportToCsv } from '@/lib/export';
import { EraporAutofillModal } from '@/components/gradebook/erapor-autofill-modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Download, FileSpreadsheet, Search, Trophy, CheckCircle2, TrendingUp, Sparkles } from 'lucide-react';

export function TeacherGradebookClient({ data }: { data: CourseGradebookData }) {
  const t = useTranslations('teacherGradebook');
  const [search, setSearch] = useState('');
  const [isEraporModalOpen, setIsEraporModalOpen] = useState(false);

  const filteredStudents = data.students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.nis && s.nis.toLowerCase().includes(search.toLowerCase())) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportExcel = () => {
    const rows = filteredStudents.map((s, index) => {
      const row: Record<string, unknown> = {
        [t('excelColNo')]: index + 1,
        [t('excelColNis')]: s.nis || '-',
        [t('excelColName')]: s.name,
        [t('excelColEmail')]: s.email,
      };

      data.quizzes.forEach((q) => {
        row[t('excelColQuiz', { title: q.title })] = s.quizScores[q.id] !== null ? s.quizScores[q.id] : '-';
      });

      data.assignments.forEach((a) => {
        row[t('excelColAssignment', { title: a.title })] = s.assignmentScores[a.id] !== null ? s.assignmentScores[a.id] : '-';
      });

      row[t('excelColAverage')] = s.average !== null ? s.average : '-';
      return row;
    });

    exportToExcel(rows, t('exportExcelName', { title: data.course.title.replace(/\s+/g, '_') }));
  };

  const handleExportCsv = () => {
    const rows = filteredStudents.map((s, index) => {
      const row: Record<string, unknown> = {
        [t('excelColNo')]: index + 1,
        [t('excelColNis')]: s.nis || '-',
        [t('excelColName')]: s.name,
        [t('excelColEmail')]: s.email,
      };

      data.quizzes.forEach((q) => {
        row[t('excelColQuiz', { title: q.title })] = s.quizScores[q.id] !== null ? s.quizScores[q.id] : '-';
      });

      data.assignments.forEach((a) => {
        row[t('excelColAssignment', { title: a.title })] = s.assignmentScores[a.id] !== null ? s.assignmentScores[a.id] : '-';
      });

      row[t('excelColAverage')] = s.average !== null ? s.average : '-';
      return row;
    });

    exportToCsv(rows, t('exportExcelName', { title: data.course.title.replace(/\s+/g, '_') }));
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/teacher/my-courses">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-[#002446] dark:text-gray-400 dark:hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-[#002446] dark:text-white">{t('title')}</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 pl-10">
            {data.course.title} • {data.course.academicYear.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setIsEraporModalOpen(true)}
            className="bg-brand-500 hover:bg-brand-600 dark:bg-[#13467b] dark:hover:bg-[#185596] text-white flex items-center gap-2 text-sm font-bold shadow-xs border border-accent-500/40"
          >
            <Sparkles className="h-4 w-4 text-[#FF8928]" />
            <span>{t('btnErapor')}</span>
            <Badge className="bg-accent-500 text-white text-[9px] px-1.5 py-0 uppercase">{t('newBadge')}</Badge>
          </Button>

          <Button
            onClick={handleExportExcel}
            variant="outline"
            className="border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 text-sm"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            {t('btnExcel')}
          </Button>
          <Button
            onClick={handleExportCsv}
            variant="outline"
            className="border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 text-sm"
          >
            <Download className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            {t('btnCsv')}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('statTotalStudents')}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-[#002446] dark:text-sky-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#002446] dark:text-white">{data.students.length}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('statEnrolledDesc')}</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('statClassAverage')}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FF8928]">
              {data.classAverage !== null ? data.classAverage : '-'}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('statAverageDesc')}</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('statHighestScore')}
            </CardTitle>
            <Trophy className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {data.highestScore !== null ? data.highestScore : '-'}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('statHighestDesc')}</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('statTotalEvaluations')}
            </CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {data.quizzes.length + data.assignments.length}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('statEvaluationsCount', { quizzes: data.quizzes.length, assignments: data.assignments.length })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grade Table */}
      <Card className="bg-white dark:bg-gray-900 shadow-xs border border-gray-200 dark:border-gray-800">
        <CardHeader className="pb-3 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg font-bold text-[#002446] dark:text-white">{t('matrixTitle')}</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 sticky left-0 bg-gray-50 dark:bg-gray-800 z-20 w-12 text-center border-r border-gray-200 dark:border-gray-700/60 font-semibold">{t('thNo')}</th>
                  <th className="py-3 px-4 sticky left-12 bg-gray-50 dark:bg-gray-800 z-20 min-w-[200px] border-r border-gray-200 dark:border-gray-700/60 font-semibold">{t('thStudent')}</th>
                  <th className="py-3 px-3 text-center min-w-[100px] border-r border-gray-200 dark:border-gray-700/60 font-semibold">{t('thNis')}</th>

                  {/* Quizzes Headers */}
                  {data.quizzes.map((q) => (
                    <th key={q.id} className="py-3 px-3 text-center min-w-[120px] bg-blue-50/70 dark:bg-blue-950/40 border-r border-gray-200 dark:border-gray-700/60">
                      <div className="flex flex-col items-center">
                        <span className="font-semibold text-blue-950 dark:text-blue-200 truncate max-w-[110px]" title={q.title}>
                          {q.title}
                        </span>
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">{t('thQuizPrefix')}</span>
                      </div>
                    </th>
                  ))}

                  {/* Assignments Headers */}
                  {data.assignments.map((a) => (
                    <th key={a.id} className="py-3 px-3 text-center min-w-[120px] bg-amber-50/70 dark:bg-amber-950/40 border-r border-gray-200 dark:border-gray-700/60">
                      <div className="flex flex-col items-center">
                        <span className="font-semibold text-amber-950 dark:text-amber-200 truncate max-w-[110px]" title={a.title}>
                          {a.title}
                        </span>
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">{t('thAssignmentPrefix', { max: a.maxScore })}</span>
                      </div>
                    </th>
                  ))}

                  <th className="py-3 px-4 text-center min-w-[110px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 font-bold sticky right-0 z-20 border-l border-emerald-200 dark:border-emerald-800/60">
                    {t('thAverage')}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4 + data.quizzes.length + data.assignments.length}
                      className="py-12 text-center text-gray-400 dark:text-gray-500 text-sm"
                    >
                      {t('emptyStudents')}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student, idx) => (
                    <tr key={student.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors group">
                      <td className="py-3 px-4 text-center font-medium text-gray-500 dark:text-gray-400 sticky left-0 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800/70 z-10 border-r border-gray-100 dark:border-gray-800">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 sticky left-12 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800/70 z-10 border-r border-gray-100 dark:border-gray-800">
                        <div className="font-semibold text-gray-900 dark:text-white text-sm">{student.name}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">{student.email}</div>
                      </td>
                      <td className="py-3 px-3 text-center text-xs text-gray-600 dark:text-gray-400 font-mono border-r border-gray-100 dark:border-gray-800">
                        {student.nis || '-'}
                      </td>

                      {/* Quiz Scores */}
                      {data.quizzes.map((q) => {
                        const score = student.quizScores[q.id];
                        return (
                          <td key={q.id} className="py-3 px-3 text-center border-r border-gray-100 dark:border-gray-800">
                            {score !== null ? (
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  score >= 75
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                                    : score >= 60
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                                }`}
                              >
                                {score}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300 dark:text-gray-600 font-medium">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Assignment Scores */}
                      {data.assignments.map((a) => {
                        const score = student.assignmentScores[a.id];
                        return (
                          <td key={a.id} className="py-3 px-3 text-center border-r border-gray-100 dark:border-gray-800">
                            {score !== null ? (
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  score >= 75
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                                    : score >= 60
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                                }`}
                              >
                                {score}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300 dark:text-gray-600 font-medium">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Final Average */}
                      <td className="py-3 px-4 text-center sticky right-0 bg-emerald-50/70 dark:bg-emerald-950/30 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 z-10 border-l border-emerald-200 dark:border-emerald-800/50">
                        {student.average !== null ? (
                          <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                            {student.average}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 dark:text-gray-600 font-medium">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Auto-Fill e-Rapor */}
      <EraporAutofillModal
        isOpen={isEraporModalOpen}
        onClose={() => setIsEraporModalOpen(false)}
        gradebookData={data}
      />
    </div>
  );
}
