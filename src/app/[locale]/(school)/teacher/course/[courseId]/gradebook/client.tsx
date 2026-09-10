'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CourseGradebookData } from '@/lib/actions/grade';
import { exportToExcel, exportToCsv } from '@/lib/export';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Download, FileSpreadsheet, Search, Trophy, CheckCircle2, TrendingUp } from 'lucide-react';

export function TeacherGradebookClient({ data }: { data: CourseGradebookData }) {
  const [search, setSearch] = useState('');

  const filteredStudents = data.students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.nis && s.nis.toLowerCase().includes(search.toLowerCase())) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportExcel = () => {
    const rows = filteredStudents.map((s, index) => {
      const row: Record<string, unknown> = {
        No: index + 1,
        NIS: s.nis || '-',
        'Nama Siswa': s.name,
        Email: s.email,
      };

      data.quizzes.forEach((q) => {
        row[`Kuis: ${q.title}`] = s.quizScores[q.id] !== null ? s.quizScores[q.id] : '-';
      });

      data.assignments.forEach((a) => {
        row[`Tugas: ${a.title}`] = s.assignmentScores[a.id] !== null ? s.assignmentScores[a.id] : '-';
      });

      row['Nilai Rata-rata'] = s.average !== null ? s.average : '-';
      return row;
    });

    exportToExcel(rows, `Buku_Nilai_${data.course.title.replace(/\s+/g, '_')}`);
  };

  const handleExportCsv = () => {
    const rows = filteredStudents.map((s, index) => {
      const row: Record<string, unknown> = {
        No: index + 1,
        NIS: s.nis || '-',
        'Nama Siswa': s.name,
        Email: s.email,
      };

      data.quizzes.forEach((q) => {
        row[`Kuis: ${q.title}`] = s.quizScores[q.id] !== null ? s.quizScores[q.id] : '-';
      });

      data.assignments.forEach((a) => {
        row[`Tugas: ${a.title}`] = s.assignmentScores[a.id] !== null ? s.assignmentScores[a.id] : '-';
      });

      row['Nilai Rata-rata'] = s.average !== null ? s.average : '-';
      return row;
    });

    exportToCsv(rows, `Buku_Nilai_${data.course.title.replace(/\s+/g, '_')}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/teacher/my-courses">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-[#002446]">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-[#002446]">Buku Nilai (Gradebook)</h1>
          </div>
          <p className="text-sm text-gray-500 pl-10">
            {data.course.title} • {data.course.academicYear.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportExcel}
            className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-2 text-sm"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#FF8928]" />
            Ekspor Excel (.xlsx)
          </Button>
          <Button
            onClick={handleExportCsv}
            variant="outline"
            className="border-gray-300 flex items-center gap-2 text-sm"
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Siswa
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-[#002446]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#002446]">{data.students.length}</div>
            <p className="text-xs text-gray-500 mt-1">Siswa terdaftar di course</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Rata-rata Kelas
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FF8928]">
              {data.classAverage !== null ? data.classAverage : '-'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Dari kuis & tugas yang telah dinilai</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Nilai Tertinggi
            </CardTitle>
            <Trophy className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {data.highestScore !== null ? data.highestScore : '-'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Pencapaian siswa tertinggi</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Evaluasi
            </CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {data.quizzes.length + data.assignments.length}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {data.quizzes.length} Kuis • {data.assignments.length} Tugas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grade Table */}
      <Card className="bg-white shadow-sm border">
        <CardHeader className="pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg font-bold text-[#002446]">Matriks Nilai Siswa</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cari siswa atau NIS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 sticky left-0 bg-gray-50 z-10 w-12 text-center">No</th>
                  <th className="py-3 px-4 sticky left-12 bg-gray-50 z-10 min-w-[200px]">Nama Siswa</th>
                  <th className="py-3 px-3 text-center min-w-[100px]">NIS</th>

                  {/* Quizzes Headers */}
                  {data.quizzes.map((q) => (
                    <th key={q.id} className="py-3 px-3 text-center min-w-[120px] bg-blue-50/50">
                      <div className="flex flex-col items-center">
                        <span className="font-semibold text-blue-900 truncate max-w-[110px]" title={q.title}>
                          {q.title}
                        </span>
                        <span className="text-[10px] text-blue-600">Kuis (100)</span>
                      </div>
                    </th>
                  ))}

                  {/* Assignments Headers */}
                  {data.assignments.map((a) => (
                    <th key={a.id} className="py-3 px-3 text-center min-w-[120px] bg-amber-50/50">
                      <div className="flex flex-col items-center">
                        <span className="font-semibold text-amber-900 truncate max-w-[110px]" title={a.title}>
                          {a.title}
                        </span>
                        <span className="text-[10px] text-amber-700">Tugas ({a.maxScore})</span>
                      </div>
                    </th>
                  ))}

                  <th className="py-3 px-4 text-center min-w-[110px] bg-emerald-50 text-emerald-900 font-bold sticky right-0 z-10">
                    Rata-rata
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4 + data.quizzes.length + data.assignments.length}
                      className="py-8 text-center text-gray-400"
                    >
                      Tidak ada data siswa
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student, idx) => (
                    <tr key={student.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 text-center font-medium text-gray-500 sticky left-0 bg-white z-10">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 sticky left-12 bg-white z-10">
                        <div className="font-semibold text-gray-900">{student.name}</div>
                        <div className="text-xs text-gray-400">{student.email}</div>
                      </td>
                      <td className="py-3 px-3 text-center text-xs text-gray-600 font-mono">
                        {student.nis || '-'}
                      </td>

                      {/* Quiz Scores */}
                      {data.quizzes.map((q) => {
                        const score = student.quizScores[q.id];
                        return (
                          <td key={q.id} className="py-3 px-3 text-center">
                            {score !== null ? (
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  score >= 75
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : score >= 60
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {score}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Assignment Scores */}
                      {data.assignments.map((a) => {
                        const score = student.assignmentScores[a.id];
                        return (
                          <td key={a.id} className="py-3 px-3 text-center">
                            {score !== null ? (
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  score >= 75
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : score >= 60
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {score}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Final Average */}
                      <td className="py-3 px-4 text-center sticky right-0 bg-emerald-50/70 z-10">
                        {student.average !== null ? (
                          <span className="text-sm font-bold text-emerald-800">
                            {student.average}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
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
    </div>
  );
}
