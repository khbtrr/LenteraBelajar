'use client';

import { useState } from 'react';
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
      No: idx + 1,
      NIS: s.nis,
      'Nama Siswa': s.name,
      'Grup Kohort / Kelas': s.cohort,
      Email: s.email,
      'Course Diikuti': s.enrolledCourses,
      'Kuis Dikerjakan': s.quizzesCompleted,
      'Tugas Dikumpulkan': s.assignmentsSubmitted,
    }));
    exportToExcel(rows, 'Monitoring_Keaktifan_Siswa');
  };

  const handleExportCsv = () => {
    const rows = filteredStudents.map((s, idx) => ({
      No: idx + 1,
      NIS: s.nis,
      'Nama Siswa': s.name,
      'Grup Kohort / Kelas': s.cohort,
      Email: s.email,
      'Course Diikuti': s.enrolledCourses,
      'Kuis Dikerjakan': s.quizzesCompleted,
      'Tugas Dikumpulkan': s.assignmentsSubmitted,
    }));
    exportToCsv(rows, 'Monitoring_Keaktifan_Siswa');
  };

  return (
    <div className="space-y-6">
      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Siswa
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-[#002446]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#002446]">{students.length}</div>
            <p className="text-xs text-gray-500 mt-1">Siswa aktif terdaftar</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Kuis Diselesaikan
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FF8928]">{totalQuizzesDone}</div>
            <p className="text-xs text-gray-500 mt-1">Akumulasi pengerjaan kuis</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Tugas Dikumpulkan
            </CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totalAssignDone}</div>
            <p className="text-xs text-gray-500 mt-1">Pengumpulan submission berkas</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Rata-rata Partisipasi
            </CardTitle>
            <BookOpen className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {students.length > 0
                ? Math.round(((totalQuizzesDone + totalAssignDone) / students.length) * 10) / 10
                : 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">Aktivitas per siswa</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="bg-white shadow-sm border">
        <CardHeader className="pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cari nama, NIS, kohort..."
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
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4 text-center">NIS</th>
                  <th className="py-3 px-4">Grup Kohort / Kelas</th>
                  <th className="py-3 px-4 text-center">Course Diikuti</th>
                  <th className="py-3 px-4 text-center">Kuis Selesai</th>
                  <th className="py-3 px-4 text-center">Tugas Dikumpulkan</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      Tidak ada data siswa
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-center text-gray-500 font-medium">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{s.name}</div>
                        <div className="text-xs text-gray-400">{s.email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs text-gray-600 font-mono">
                        {s.nis}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                          {s.cohort}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-[#002446]">
                        {s.enrolledCourses}
                      </td>
                      <td className="py-3.5 px-4 text-center text-gray-700">
                        {s.quizzesCompleted}
                      </td>
                      <td className="py-3.5 px-4 text-center text-gray-700">
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
