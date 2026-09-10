'use client';

import { useState } from 'react';
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
  const [search, setSearch] = useState('');

  const filteredTeachers = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.nip.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalCourses = teachers.reduce((acc, t) => acc + t.courseCount, 0);
  const totalContents = teachers.reduce((acc, t) => acc + t.totalContents, 0);
  const totalEvaluations = teachers.reduce((acc, t) => acc + t.totalQuizzes + t.totalAssignments, 0);

  const handleExportExcel = () => {
    const rows = filteredTeachers.map((t, idx) => ({
      No: idx + 1,
      NIP: t.nip,
      'Nama Guru': t.name,
      Email: t.email,
      'Total Course': t.courseCount,
      'Course Aktif': t.activeCourseCount,
      'Siswa Terdaftar': t.totalStudentsEnrolled,
      'Total Bab Modul': t.totalModules,
      'Total Materi': t.totalContents,
      'Total Kuis': t.totalQuizzes,
      'Total Tugas': t.totalAssignments,
    }));
    exportToExcel(rows, 'Monitoring_Keaktifan_Guru');
  };

  const handleExportCsv = () => {
    const rows = filteredTeachers.map((t, idx) => ({
      No: idx + 1,
      NIP: t.nip,
      'Nama Guru': t.name,
      Email: t.email,
      'Total Course': t.courseCount,
      'Course Aktif': t.activeCourseCount,
      'Siswa Terdaftar': t.totalStudentsEnrolled,
      'Total Bab Modul': t.totalModules,
      'Total Materi': t.totalContents,
      'Total Kuis': t.totalQuizzes,
      'Total Tugas': t.totalAssignments,
    }));
    exportToCsv(rows, 'Monitoring_Keaktifan_Guru');
  };

  return (
    <div className="space-y-6">
      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Guru
            </CardTitle>
            <Users className="h-4 w-4 text-[#002446]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#002446]">{teachers.length}</div>
            <p className="text-xs text-gray-500 mt-1">Guru terdaftar di sekolah</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Course
            </CardTitle>
            <BookOpen className="h-4 w-4 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FF8928]">{totalCourses}</div>
            <p className="text-xs text-gray-500 mt-1">Mata pelajaran yang dibuat</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Konten Materi
            </CardTitle>
            <Layers className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{totalContents}</div>
            <p className="text-xs text-gray-500 mt-1">Artikel, dokumen, video</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Kuis & Tugas
            </CardTitle>
            <Award className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totalEvaluations}</div>
            <p className="text-xs text-gray-500 mt-1">Instrumen asesmen dibuat</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="bg-white shadow-sm border">
        <CardHeader className="pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cari guru atau NIP..."
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
              Ekspor Excel
            </Button>
            <Button
              onClick={handleExportCsv}
              variant="outline"
              className="border-gray-300 flex items-center gap-1.5 text-xs h-9"
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nama Guru</th>
                  <th className="py-3 px-4 text-center">NIP</th>
                  <th className="py-3 px-4 text-center">Course Diampu</th>
                  <th className="py-3 px-4 text-center">Siswa Terdaftar</th>
                  <th className="py-3 px-4 text-center">Materi Diunggah</th>
                  <th className="py-3 px-4 text-center">Kuis & Tugas</th>
                  <th className="py-3 px-4 text-center">Indikator Keaktifan</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">
                      Tidak ada data guru yang cocok
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((t, idx) => {
                    const totalItems = t.totalContents + t.totalQuizzes + t.totalAssignments;
                    const isActiveHigh = totalItems >= 5;
                    const isActiveMedium = totalItems >= 1;

                    return (
                      <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3.5 px-4 text-center text-gray-500 font-medium">{idx + 1}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900">{t.name}</div>
                          <div className="text-xs text-gray-400">{t.email}</div>
                        </td>
                        <td className="py-3.5 px-4 text-center text-xs text-gray-600 font-mono">
                          {t.nip}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-bold text-[#002446]">{t.courseCount}</span>
                          <span className="text-xs text-gray-400"> ({t.activeCourseCount} aktif)</span>
                        </td>
                        <td className="py-3.5 px-4 text-center text-gray-700 font-medium">
                          {t.totalStudentsEnrolled}
                        </td>
                        <td className="py-3.5 px-4 text-center text-gray-700">
                          {t.totalContents} materi <span className="text-xs text-gray-400">({t.totalModules} bab)</span>
                        </td>
                        <td className="py-3.5 px-4 text-center text-gray-700">
                          {t.totalQuizzes} kuis • {t.totalAssignments} tugas
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isActiveHigh ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              Sangat Aktif
                            </span>
                          ) : isActiveMedium ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                              Belum Ada Konten
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
