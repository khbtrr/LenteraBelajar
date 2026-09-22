'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { exportToExcel, exportToCsv } from '@/lib/export';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, FileSpreadsheet, Download, GraduationCap, CheckCircle2, Clock, BookOpen } from 'lucide-react';

interface StudentItem {
  id: string;
  name: string;
  email: string;
  nis: string;
  cohort: string;
  enrolledCourses: number;
  quizzesCompleted: number;
  assignmentsSubmitted: number;
}

export function StudentActivityClient({ students }: { students: StudentItem[] }) {
  const t = useTranslations('supervisorStudentActivity');
  const [search, setSearch] = useState('');

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.nis.toLowerCase().includes(search.toLowerCase()) ||
      s.cohort.toLowerCase().includes(search.toLowerCase())
  );

  const totalQuizzesDone = students.reduce((acc, s) => acc + s.quizzesCompleted, 0);
  const totalAssignDone = students.reduce((acc, s) => acc + s.assignmentsSubmitted, 0);

  const handleExportExcel = () => {
    const rows = filteredStudents.map((s, idx) => ({
      [t('colNo')]: idx + 1,
      [t('colNis')]: s.nis,
      [t('colName')]: s.name,
      [t('colCohort')]: s.cohort,
      Email: s.email,
      [t('colCoursesEnrolled')]: s.enrolledCourses,
      [t('colQuizzesDone')]: s.quizzesCompleted,
      [t('colAssignmentsSubmitted')]: s.assignmentsSubmitted,
    }));
    exportToExcel(rows, t('excelFilename'));
  };

  const handleExportCsv = () => {
    const rows = filteredStudents.map((s, idx) => ({
      [t('colNo')]: idx + 1,
      [t('colNis')]: s.nis,
      [t('colName')]: s.name,
      [t('colCohort')]: s.cohort,
      Email: s.email,
      [t('colCoursesEnrolled')]: s.enrolledCourses,
      [t('colQuizzesDone')]: s.quizzesCompleted,
      [t('colAssignmentsSubmitted')]: s.assignmentsSubmitted,
    }));
    exportToCsv(rows, t('excelFilename'));
  };

  return (
    <div className="space-y-6">
      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t('totalStudents')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#002446] dark:text-blue-400 flex items-center justify-center">
              <GraduationCap className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#002446] dark:text-white">{students.length}</div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t('totalStudentsDesc')}</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t('quizzesCompleted')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-[#FF8928] dark:text-amber-400 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FF8928] dark:text-amber-400">{totalQuizzesDone}</div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t('quizzesCompletedDesc')}</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t('assignmentsSubmitted')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalAssignDone}</div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t('assignmentsSubmittedDesc')}</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t('avgParticipation')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <BookOpen className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {students.length > 0
                ? Math.round(((totalQuizzesDone + totalAssignDone) / students.length) * 10) / 10
                : 0}
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t('avgParticipationDesc')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm border">
        <CardHeader className="pb-3 border-b border-gray-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-400" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportExcel}
              className="bg-[#002446] hover:bg-[#002446]/90 dark:bg-brand-600 dark:hover:bg-brand-500 text-white flex items-center gap-1.5 text-xs h-9"
            >
              <FileSpreadsheet className="h-4 w-4 text-[#FF8928]" />
              {t('exportExcel')}
            </Button>
            <Button
              onClick={handleExportCsv}
              variant="outline"
              className="border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1.5 text-xs h-9"
            >
              <Download className="h-4 w-4" />
              {t('exportCsv')}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700/60 text-gray-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">{t('colNo')}</th>
                  <th className="py-3 px-4">{t('colName')}</th>
                  <th className="py-3 px-4 text-center">{t('colNis')}</th>
                  <th className="py-3 px-4">{t('colCohort')}</th>
                  <th className="py-3 px-4 text-center">{t('colCoursesEnrolled')}</th>
                  <th className="py-3 px-4 text-center">{t('colQuizzesDone')}</th>
                  <th className="py-3 px-4 text-center">{t('colAssignmentsSubmitted')}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400 dark:text-slate-500">
                      {t('noStudentsFound')}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-center text-gray-500 dark:text-slate-400 font-medium">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 dark:text-slate-100">{s.name}</div>
                        <div className="text-xs text-gray-400 dark:text-slate-400">{s.email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs text-gray-600 dark:text-slate-400 font-mono">
                        {s.nis}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-transparent dark:border-slate-700">
                          {s.cohort}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-[#002446] dark:text-white">
                        {s.enrolledCourses}
                      </td>
                      <td className="py-3.5 px-4 text-center text-gray-700 dark:text-slate-300">
                        {s.quizzesCompleted}
                      </td>
                      <td className="py-3.5 px-4 text-center text-gray-700 dark:text-slate-300">
                        {s.assignmentsSubmitted}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
