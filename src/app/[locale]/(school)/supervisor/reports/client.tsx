'use client';

import { useState } from 'react';
import { exportToExcel, exportToCsv } from '@/lib/export';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, FileSpreadsheet, Download, BookOpen, Users, Trophy, BarChart3 } from 'lucide-react';

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
      No: idx + 1,
      'Mata Pelajaran': r.title,
      'Guru Pengampu': r.teacher,
      'Tahun Ajaran': r.academicYear,
      Kategori: r.category,
      'Jumlah Siswa': r.studentsCount,
      'Jumlah Bab Modul': r.modulesCount,
      'Nilai Tercatat': r.gradesRecorded,
      'Rata-rata Nilai': r.averageScore !== null ? r.averageScore : '-',
    }));
    exportToExcel(rows, 'Laporan_Rekap_Nilai_Sekolah');
  };

  const handleExportCsv = () => {
    const rows = filteredReports.map((r, idx) => ({
      No: idx + 1,
      'Mata Pelajaran': r.title,
      'Guru Pengampu': r.teacher,
      'Tahun Ajaran': r.academicYear,
      Kategori: r.category,
      'Jumlah Siswa': r.studentsCount,
      'Jumlah Bab Modul': r.modulesCount,
      'Nilai Tercatat': r.gradesRecorded,
      'Rata-rata Nilai': r.averageScore !== null ? r.averageScore : '-',
    }));
    exportToCsv(rows, 'Laporan_Rekap_Nilai_Sekolah');
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Mata Pelajaran
            </CardTitle>
            <BookOpen className="h-4 w-4 text-[#002446]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#002446]">{filteredReports.length}</div>
            <p className="text-xs text-gray-500 mt-1">Course yang dievaluasi</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Rata-rata Sekolah
            </CardTitle>
            <Trophy className="h-4 w-4 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FF8928]">
              {overallAverage !== null ? overallAverage : '-'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Ketercapaian nilai seluruh mapel</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Data Nilai Masuk
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {filteredReports.reduce((acc, r) => acc + r.gradesRecorded, 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Akumulasi entri kuis & tugas</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Siswa Terbina
            </CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {filteredReports.reduce((acc, r) => acc + r.studentsCount, 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Total enrollment mapel</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Export Bar */}
      <Card className="bg-white shadow-sm border">
        <CardHeader className="pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cari mapel atau guru..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <Select value={selectedAY} onValueChange={setSelectedAY}>
              <SelectTrigger className="w-full sm:w-48 h-9 text-xs">
                <SelectValue placeholder="Pilih Tahun Ajaran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Tahun Ajaran</SelectItem>
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
              className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-1.5 text-xs h-9"
            >
              <FileSpreadsheet className="h-4 w-4 text-[#FF8928]" />
              Unduh Excel (.xlsx)
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
                  <th className="py-3 px-4">Mata Pelajaran</th>
                  <th className="py-3 px-4">Guru Pengampu</th>
                  <th className="py-3 px-4">Tahun Ajaran</th>
                  <th className="py-3 px-4 text-center">Siswa</th>
                  <th className="py-3 px-4 text-center">Materi</th>
                  <th className="py-3 px-4 text-center">Nilai Masuk</th>
                  <th className="py-3 px-4 text-center">Rata-rata Nilai</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">
                      Tidak ada data laporan
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-center text-gray-500 font-medium">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{r.title}</div>
                        <div className="text-xs text-gray-400">{r.category}</div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-700">{r.teacher}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800">
                          {r.academicYear}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-gray-800">
                        {r.studentsCount}
                      </td>
                      <td className="py-3.5 px-4 text-center text-gray-600">
                        {r.modulesCount} bab
                      </td>
                      <td className="py-3.5 px-4 text-center text-gray-600">
                        {r.gradesRecorded}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {r.averageScore !== null ? (
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                              r.averageScore >= 75
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.averageScore >= 60
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {r.averageScore}
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
