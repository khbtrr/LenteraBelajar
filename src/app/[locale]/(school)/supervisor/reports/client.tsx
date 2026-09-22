'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { exportToExcel, exportToCsv } from '@/lib/export';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from '@/i18n/navigation';
import { Search, FileSpreadsheet, Download, BookOpen, Users, Trophy, BarChart3, Eye } from 'lucide-react';

interface ReportItem {
  id: string;
  title: string;
  teacher: string;
  academicYear: string;
  category: string;
  studentsCount: number;
  modulesCount: number;
  gradesRecorded: number;
  averageScore: number | null;
}

interface ReportsClientProps {
  initialReports: ReportItem[];
  academicYears: Array<{ id: string; name: string }>;
}

export function SupervisorReportsClient({ initialReports, academicYears }: ReportsClientProps) {
  const t = useTranslations('supervisorReports');
  const [reports] = useState(initialReports);
  const [search, setSearch] = useState('');
  const [selectedAY, setSelectedAY] = useState<string>('ALL');

  const filteredReports = reports.filter((r) => {
    const matchSearch =
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.teacher.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase());
    const matchAY = selectedAY === 'ALL' || r.academicYear === selectedAY;
    return matchSearch && matchAY;
  });

  const validAverages = filteredReports
    .map((r) => r.averageScore)
    .filter((s): s is number => s !== null);

  const overallAverage =
    validAverages.length > 0
      ? Math.round((validAverages.reduce((a, b) => a + b, 0) / validAverages.length) * 10) / 10
      : null;

  const handleExportExcel = () => {
    const rows = filteredReports.map((r, idx) => ({
      [t('colNo')]: idx + 1,
      [t('colCourse')]: r.title,
      [t('colTeacher')]: r.teacher,
      [t('colAcademicYear')]: r.academicYear,
      Kategori: r.category,
      [t('colStudents')]: r.studentsCount,
      [t('colMaterials')]: r.modulesCount,
      [t('colRecordedGrades')]: r.gradesRecorded,
      [t('colAverageGrade')]: r.averageScore !== null ? r.averageScore : '-',
    }));
    exportToExcel(rows, t('excelFilename'));
  };

  const handleExportCsv = () => {
    const rows = filteredReports.map((r, idx) => ({
      [t('colNo')]: idx + 1,
      [t('colCourse')]: r.title,
      [t('colTeacher')]: r.teacher,
      [t('colAcademicYear')]: r.academicYear,
      Kategori: r.category,
      [t('colStudents')]: r.studentsCount,
      [t('colMaterials')]: r.modulesCount,
      [t('colRecordedGrades')]: r.gradesRecorded,
      [t('colAverageGrade')]: r.averageScore !== null ? r.averageScore : '-',
    }));
    exportToCsv(rows, t('excelFilename'));
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t('courses')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#002446] dark:text-blue-400 flex items-center justify-center">
              <BookOpen className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#002446] dark:text-white">{filteredReports.length}</div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t('coursesDesc')}</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t('schoolAverage')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-[#FF8928] dark:text-amber-400 flex items-center justify-center">
              <Trophy className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FF8928] dark:text-amber-400">
              {overallAverage !== null ? overallAverage : '-'}
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t('schoolAverageDesc')}</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t('recordedGrades')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <BarChart3 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {filteredReports.reduce((acc, r) => acc + r.gradesRecorded, 0)}
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t('recordedGradesDesc')}</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t('guidedStudents')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {filteredReports.reduce((acc, r) => acc + r.studentsCount, 0)}
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t('guidedStudentsDesc')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Export Bar */}
      <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm border">
        <CardHeader className="pb-3 border-b border-gray-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-400" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <Select value={selectedAY} onValueChange={setSelectedAY}>
              <SelectTrigger className="w-full sm:w-48 h-9 text-xs">
                <SelectValue placeholder={t('selectAcademicYear')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('allAcademicYears')}</SelectItem>
                {academicYears.map((ay) => (
                  <SelectItem key={ay.id} value={ay.name}>
                    {ay.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportExcel}
              className="bg-[#002446] hover:bg-[#002446]/90 dark:bg-brand-600 dark:hover:bg-brand-500 text-white flex items-center gap-1.5 text-xs h-9"
            >
              <FileSpreadsheet className="h-4 w-4 text-[#FF8928]" />
              {t('downloadExcel')}
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
                  <th className="py-3 px-4">{t('colCourse')}</th>
                  <th className="py-3 px-4">{t('colTeacher')}</th>
                  <th className="py-3 px-4">{t('colAcademicYear')}</th>
                  <th className="py-3 px-4 text-center">{t('colStudents')}</th>
                  <th className="py-3 px-4 text-center">{t('colMaterials')}</th>
                  <th className="py-3 px-4 text-center">{t('colRecordedGrades')}</th>
                  <th className="py-3 px-4 text-center">{t('colAverageGrade')}</th>
                  <th className="py-3 px-4 text-center">{t('colAction')}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-400 dark:text-slate-500">
                      {t('noReportsFound')}
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-center text-gray-500 dark:text-slate-400 font-medium">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 dark:text-slate-100">{r.title}</div>
                        <div className="text-xs text-gray-400 dark:text-slate-400">{r.category}</div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-700 dark:text-slate-300">{r.teacher}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-transparent dark:border-blue-800/50">
                          {r.academicYear}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-gray-800 dark:text-slate-200">
                        {r.studentsCount}
                      </td>
                      <td className="py-3.5 px-4 text-center text-gray-600 dark:text-slate-300">
                        {t('chaptersCount', { count: r.modulesCount })}
                      </td>
                      <td className="py-3.5 px-4 text-center text-gray-600 dark:text-slate-300">
                        {r.gradesRecorded}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {r.averageScore !== null ? (
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                              r.averageScore >= 75
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-transparent dark:border-emerald-800/40'
                                : r.averageScore >= 60
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-transparent dark:border-amber-800/40'
                                : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-transparent dark:border-red-800/40'
                            }`}
                          >
                            {r.averageScore}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Link href={`/teacher/course/${r.id}/modules`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-semibold border-[#002446]/20 dark:border-slate-700 text-[#002446] dark:text-slate-200 hover:bg-[#002446] dark:hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-1.5 mx-auto"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {t('viewCourseBtn')}
                          </Button>
                        </Link>
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
