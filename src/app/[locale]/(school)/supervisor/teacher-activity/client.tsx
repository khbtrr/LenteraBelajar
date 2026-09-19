'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { exportToExcel, exportToCsv } from '@/lib/export';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, FileSpreadsheet, Download, BookOpen, Layers, Users, Award } from 'lucide-react';

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
}

export function TeacherActivityClient({ teachers }: { teachers: TeacherItem[] }) {
  const t = useTranslations('supervisorTeacherActivity');
  const [search, setSearch] = useState('');

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
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('totalTeachers')}
            </CardTitle>
            <Users className="h-4 w-4 text-[#002446]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#002446]">{teachers.length}</div>
            <p className="text-xs text-gray-500 mt-1">{t('totalTeachersDesc')}</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('totalCourses')}
            </CardTitle>
            <BookOpen className="h-4 w-4 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FF8928]">{totalCourses}</div>
            <p className="text-xs text-gray-500 mt-1">{t('totalCoursesDesc')}</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('totalContents')}
            </CardTitle>
            <Layers className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{totalContents}</div>
            <p className="text-xs text-gray-500 mt-1">{t('totalContentsDesc')}</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('evaluations')}
            </CardTitle>
            <Award className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totalEvaluations}</div>
            <p className="text-xs text-gray-500 mt-1">{t('evaluationsDesc')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="bg-white shadow-sm border">
        <CardHeader className="pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
              className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-1.5 text-xs h-9"
            >
              <FileSpreadsheet className="h-4 w-4 text-[#FF8928]" />
              {t('exportExcel')}
            </Button>
            <Button
              onClick={handleExportCsv}
              variant="outline"
              className="border-gray-300 flex items-center gap-1.5 text-xs h-9"
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
                <tr className="bg-gray-50 border-b text-gray-600 text-xs uppercase tracking-wider">
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

              <tbody className="divide-y divide-gray-100">
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">
                      {t('noTeachersFound')}
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((teacher, idx) => {
                    const totalItems = teacher.totalContents + teacher.totalQuizzes + teacher.totalAssignments;
                    const isActiveHigh = totalItems >= 5;
                    const isActiveMedium = totalItems >= 1;

                    return (
                      <tr key={teacher.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3.5 px-4 text-center text-gray-500 font-medium">{idx + 1}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900">{teacher.name}</div>
                          <div className="text-xs text-gray-400">{teacher.email}</div>
                        </td>
                        <td className="py-3.5 px-4 text-center text-xs text-gray-600 font-mono">
                          {teacher.nip}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-bold text-[#002446]">{teacher.courseCount}</span>
                          <span className="text-xs text-gray-400"> {t('activeCoursesCount', { count: teacher.activeCourseCount })}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center text-gray-700 font-medium">
                          {teacher.totalStudentsEnrolled}
                        </td>
                        <td className="py-3.5 px-4 text-center text-gray-700">
                          {t('materialsDetail', { contents: teacher.totalContents, modules: teacher.totalModules })}
                        </td>
                        <td className="py-3.5 px-4 text-center text-gray-700">
                          {t('assessmentsDetail', { quizzes: teacher.totalQuizzes, assignments: teacher.totalAssignments })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isActiveHigh ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              {t('statusVeryActive')}
                            </span>
                          ) : isActiveMedium ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                              {t('statusActive')}
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
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
    </div>
  );
}
