'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { exportToExcel, exportToCsv } from '@/lib/export';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Search, FileSpreadsheet, Download, BookOpen, Layers, Users, Award, Eye, ExternalLink } from 'lucide-react';

interface TeacherCourseSummary {
  id: string;
  title: string;
  status: string;
  enrollmentsCount: number;
  modulesCount: number;
}

interface TeacherItem {
  id: string;
  name: string;
  email: string;
  nip: string;
  courseCount: number;
  activeCourseCount: number;
  totalStudentsEnrolled: number;
  totalModules: number;
  totalContents: number;
  totalQuizzes: number;
  totalAssignments: number;
  courses?: TeacherCourseSummary[];
}

export function TeacherActivityClient({ teachers }: { teachers: TeacherItem[] }) {
  const t = useTranslations('supervisorTeacherActivity');
  const [search, setSearch] = useState('');
  const [selectedTeacherForCourses, setSelectedTeacherForCourses] = useState<TeacherItem | null>(null);

  const filteredTeachers = teachers.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.nip.toLowerCase().includes(search.toLowerCase()) ||
      item.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalCourses = teachers.reduce((acc, item) => acc + item.courseCount, 0);
  const totalContents = teachers.reduce((acc, item) => acc + item.totalContents, 0);
  const totalEvaluations = teachers.reduce((acc, item) => acc + item.totalQuizzes + item.totalAssignments, 0);

  const handleExportExcel = () => {
    const rows = filteredTeachers.map((item, idx) => ({
      [t('colNo')]: idx + 1,
      [t('colNip')]: item.nip,
      [t('colName')]: item.name,
      Email: item.email,
      [t('totalCourses')]: item.courseCount,
      [t('colStudentsEnrolled')]: item.totalStudentsEnrolled,
      [t('colMaterialsUploaded')]: item.totalContents,
      [t('colQuizzesAssignments')]: item.totalQuizzes + item.totalAssignments,
    }));
    exportToExcel(rows, t('excelFilename'));
  };

  const handleExportCsv = () => {
    const rows = filteredTeachers.map((item, idx) => ({
      [t('colNo')]: idx + 1,
      [t('colNip')]: item.nip,
      [t('colName')]: item.name,
      Email: item.email,
      [t('totalCourses')]: item.courseCount,
      [t('colStudentsEnrolled')]: item.totalStudentsEnrolled,
      [t('colMaterialsUploaded')]: item.totalContents,
      [t('colQuizzesAssignments')]: item.totalQuizzes + item.totalAssignments,
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
              {t('totalTeachers')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#002446] dark:text-blue-400 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#002446] dark:text-white">{teachers.length}</div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t('totalTeachersDesc')}</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t('totalCourses')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-[#FF8928] dark:text-amber-400 flex items-center justify-center">
              <BookOpen className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FF8928] dark:text-amber-400">{totalCourses}</div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t('totalCoursesDesc')}</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t('totalContents')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalContents}</div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t('totalContentsDesc')}</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t('evaluations')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Award className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalEvaluations}</div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t('evaluationsDesc')}</p>
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
                  <th className="py-3 px-4 text-center">{t('colNip')}</th>
                  <th className="py-3 px-4 text-center">{t('colCourseTaught')}</th>
                  <th className="py-3 px-4 text-center">{t('colStudentsEnrolled')}</th>
                  <th className="py-3 px-4 text-center">{t('colMaterialsUploaded')}</th>
                  <th className="py-3 px-4 text-center">{t('colQuizzesAssignments')}</th>
                  <th className="py-3 px-4 text-center">{t('colActivityIndicator')}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400 dark:text-slate-500">
                      {t('noTeachersFound')}
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((teacher, idx) => {
                    const totalItems = teacher.totalContents + teacher.totalQuizzes + teacher.totalAssignments;
                    const isActiveHigh = totalItems >= 5;
                    const isActiveMedium = totalItems >= 1;

                    return (
                      <tr key={teacher.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 text-center text-gray-500 dark:text-slate-400 font-medium">{idx + 1}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900 dark:text-slate-100">{teacher.name}</div>
                          <div className="text-xs text-gray-400 dark:text-slate-400">{teacher.email}</div>
                        </td>
                        <td className="py-3.5 px-4 text-center text-xs text-gray-600 dark:text-slate-400 font-mono">
                          {teacher.nip}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div>
                              <span className="font-bold text-[#002446] dark:text-white">{teacher.courseCount}</span>
                              <span className="text-xs text-gray-400 dark:text-slate-400"> {t('activeCoursesCount', { count: teacher.activeCourseCount })}</span>
                            </div>
                            {teacher.courseCount > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedTeacherForCourses(teacher)}
                                className="h-6 px-2 text-[11px] font-medium text-brand-600 dark:text-sky-400 hover:text-brand-800 dark:hover:text-sky-300 hover:bg-brand-50 dark:hover:bg-slate-800 flex items-center gap-1"
                              >
                                <Eye className="h-3 w-3" />
                                {t('btnViewCourses')}
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center text-gray-700 dark:text-slate-300 font-medium">
                          {teacher.totalStudentsEnrolled}
                        </td>
                        <td className="py-3.5 px-4 text-center text-gray-700 dark:text-slate-300">
                          {t('materialsDetail', { contents: teacher.totalContents, modules: teacher.totalModules })}
                        </td>
                        <td className="py-3.5 px-4 text-center text-gray-700 dark:text-slate-300">
                          {t('assessmentsDetail', { quizzes: teacher.totalQuizzes, assignments: teacher.totalAssignments })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isActiveHigh ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-transparent dark:border-emerald-800/40">
                              {t('statusVeryActive')}
                            </span>
                          ) : isActiveMedium ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-transparent dark:border-blue-800/40">
                              {t('statusActive')}
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-transparent dark:border-slate-700">
                              {t('statusNoContent')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Daftar Kursus Guru */}
      <Dialog
        open={!!selectedTeacherForCourses}
        onOpenChange={(open) => {
          if (!open) setSelectedTeacherForCourses(null);
        }}
      >
        <DialogContent className="sm:max-w-xl bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#002446] dark:text-white">
              {selectedTeacherForCourses
                ? t('modalCoursesTitle', { name: selectedTeacherForCourses.name })
                : ''}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500 dark:text-slate-400">
              {t('modalCoursesSubtitle')}
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 max-h-[60vh] overflow-y-auto space-y-2">
            {selectedTeacherForCourses?.courses && selectedTeacherForCourses.courses.length > 0 ? (
              selectedTeacherForCourses.courses.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-[#002446]/40 dark:hover:border-slate-600 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="font-semibold text-sm text-[#002446] dark:text-white truncate">
                      {c.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-transparent dark:border-emerald-800/40'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                        }`}
                      >
                        {c.status}
                      </span>
                      <span>•</span>
                      <span>{c.modulesCount} Bab</span>
                      <span>•</span>
                      <span>{c.enrollmentsCount} Siswa</span>
                    </div>
                  </div>

                  <Link href={`/teacher/course/${c.id}/modules`}>
                    <Button
                      size="sm"
                      className="bg-[#002446] hover:bg-[#002446]/90 dark:bg-brand-600 dark:hover:bg-brand-500 text-white text-xs flex items-center gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t('btnViewCourses')}
                    </Button>
                  </Link>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-slate-500">
                {t('noCourses')}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
