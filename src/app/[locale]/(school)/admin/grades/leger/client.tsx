'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileSpreadsheet,
  Printer,
  Search,
  UsersRound,
  GraduationCap,
  Award,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  School,
  Calendar,
} from 'lucide-react';
import type { CohortLegerReportData } from '@/lib/actions/leger';
import * as XLSX from 'xlsx';
import { useTranslations, useLocale } from 'next-intl';

interface Props {
  cohorts: Array<{ id: string; name: string; _count: { members: number } }>;
  academicYears: Array<{ id: string; name: string; status: string }>;
  initialCohortId: string;
  initialAcademicYearId: string;
  initialLegerData: CohortLegerReportData | null;
}

export function AdminLegerClient({
  cohorts,
  academicYears,
  initialCohortId,
  initialAcademicYearId,
  initialLegerData,
}: Props) {
  const t = useTranslations('adminLeger');
  const locale = useLocale();
  const dateLocale = locale === 'id' ? 'id-ID' : 'en-US';
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [selectedCohortId, setSelectedCohortId] = useState(initialCohortId);
  const [selectedYearId, setSelectedYearId] = useState(initialAcademicYearId);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setSelectedCohortId(initialCohortId);
    setSelectedYearId(initialAcademicYearId);
  }, [initialCohortId, initialAcademicYearId]);

  const legerData = initialLegerData;

  const handleFilterChange = (cohortId: string, yearId: string) => {
    setSelectedCohortId(cohortId);
    setSelectedYearId(yearId);
    startTransition(() => {
      const params = new URLSearchParams();
      if (cohortId) params.set('cohortId', cohortId);
      if (yearId) params.set('academicYearId', yearId);
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // Filter siswa berdasarkan pencarian
  const filteredStudents = legerData
    ? legerData.students.filter((st) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          st.name.toLowerCase().includes(q) ||
          (st.nis && st.nis.toLowerCase().includes(q))
        );
      })
    : [];

  // Ekspor Excel (.xlsx) Lengkap dengan Kop Sekolah
  const handleExportExcel = () => {
    if (!legerData || legerData.students.length === 0) return;

    const rows: any[] = [];

    // Header Kop Sekolah
    rows.push([legerData.school.name.toUpperCase()]);
    if (legerData.school.address) rows.push([legerData.school.address]);
    rows.push([
      t('exportHeaderTitle', { cohort: legerData.cohort.name.toUpperCase() }),
    ]);
    rows.push([
      t('exportHeaderSub', {
        year: legerData.academicYear?.name || '-',
        kkm: legerData.school.passingGrade,
        date: new Date().toLocaleDateString(dateLocale),
      }),
    ]);
    rows.push([]); // Baris kosong

    // Baris Header Kolom
    const headerRow = [
      t('colNo'),
      t('colNis'),
      t('colStudentName'),
      ...legerData.subjects.map((s) => s.title),
      t('colTotalScore'),
      t('colAverage'),
      t('colRank'),
      t('colAttendanceH'),
      t('colAttendanceS'),
      t('colAttendanceI'),
      t('colAttendanceA'),
      t('colStatus'),
    ];
    rows.push(headerRow);

    // Baris Data Siswa
    filteredStudents.forEach((st, idx) => {
      const subjectCols = legerData.subjects.map((sub) => {
        const score = st.subjectGrades[sub.id];
        return score !== null ? score : '-';
      });

      rows.push([
        idx + 1,
        st.nis || '-',
        st.name,
        ...subjectCols,
        st.totalScore,
        st.averageScore !== null ? st.averageScore : '-',
        st.rank,
        st.attendance.present,
        st.attendance.sick,
        st.attendance.permission,
        st.attendance.absent,
        st.isPassed ? t('statusPassed') : t('statusNotPassed'),
      ]);
    });

    // Baris Statistik Kelas
    rows.push([]);
    const avgRow = [
      '',
      '',
      t('summaryClassAverage'),
      ...legerData.subjects.map((s) => {
        const stat = legerData.subjectStats[s.id];
        return stat?.average !== null && stat?.average !== undefined ? stat.average : '-';
      }),
      '',
      legerData.overallClassAverage !== null ? legerData.overallClassAverage : '-',
      '',
      '',
      '',
      '',
      '',
      '',
    ];
    rows.push(avgRow);

    const highestRow = [
      '',
      '',
      t('summaryHighest'),
      ...legerData.subjects.map((s) => {
        const stat = legerData.subjectStats[s.id];
        return stat?.highest !== null && stat?.highest !== undefined ? stat.highest : '-';
      }),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ];
    rows.push(highestRow);

    const lowestRow = [
      '',
      '',
      t('summaryLowest'),
      ...legerData.subjects.map((s) => {
        const stat = legerData.subjectStats[s.id];
        return stat?.lowest !== null && stat?.lowest !== undefined ? stat.lowest : '-';
      }),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ];
    rows.push(lowestRow);

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Styling kolom width
    worksheet['!cols'] = [
      { wch: 5 }, // No
      { wch: 14 }, // NIS
      { wch: 28 }, // Nama Siswa
      ...legerData.subjects.map(() => ({ wch: 16 })), // Subject columns
      { wch: 12 }, // Jumlah
      { wch: 12 }, // Rata-rata
      { wch: 10 }, // Peringkat
      { wch: 9 }, // H
      { wch: 9 }, // S
      { wch: 9 }, // I
      { wch: 9 }, // A
      { wch: 15 }, // Keterangan
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Leger_${legerData.cohort.name.slice(0, 25)}`);

    const safeCohortName = legerData.cohort.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(workbook, `Leger_Nilai_${safeCohortName}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Printable Stylesheet */}
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          /* Sembunyikan elemen non-cetak */
          header,
          aside,
          nav,
          .no-print,
          button,
          input,
          .print-hidden {
            display: none !important;
          }
          .print-full-width {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-table {
            font-size: 9pt !important;
          }
          .print-table th,
          .print-table td {
            padding: 4px 6px !important;
            border: 1px solid #333 !important;
          }
          .print-kop {
            display: block !important;
            margin-bottom: 15px !important;
          }
        }
      `}</style>

      {/* Top Header & Navigation (Non-print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#002446] dark:text-white">
                {t('pageTitle')}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('pageDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={!legerData || isPending}
            className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200"
          >
            <Printer className="h-4 w-4 text-blue-600" />
            {t('printPdfBtn')}
          </Button>

          <Button
            onClick={handleExportExcel}
            disabled={!legerData || isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {t('btnExportExcel')}
          </Button>
        </div>
      </div>

      {/* Filter Bar (Non-print) */}
      <Card className="no-print border-gray-200 dark:border-gray-800 shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                {t('cohortLabel')}
              </Label>
              <Select
                value={selectedCohortId}
                onValueChange={(val) => handleFilterChange(val, selectedYearId)}
                disabled={isPending}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={t('cohortLabel')} />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({t('studentsPersonUnit', { count: c._count.members })})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                {t('academicYearLabel')}
              </Label>
              <Select
                value={selectedYearId}
                onValueChange={(val) => handleFilterChange(selectedCohortId, val)}
                disabled={isPending}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={t('academicYearLabel')} />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((ay) => (
                    <SelectItem key={ay.id} value={ay.id}>
                      {ay.name} {ay.status === 'ACTIVE' ? `(${locale === 'id' ? 'Aktif' : 'Active'})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                {t('searchStudentPlaceholder')}
              </Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t('searchStudentPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Leger View (Screen + Print Friendly) */}
      {legerData ? (
        <Card className="border-gray-200 dark:border-gray-800 shadow-md print-full-width">
          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Kop Resmi Sekolah */}
            <div className="border-b-2 border-gray-900 dark:border-gray-100 pb-4 text-center space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-wider">
                {legerData.school.name}
              </h2>
              {legerData.school.address && (
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {legerData.school.address}
                </p>
              )}
              <div className="pt-2">
                <h3 className="text-base sm:text-lg font-bold text-[#002446] dark:text-blue-400 uppercase">
                  {t('exportHeaderTitle', { cohort: legerData.cohort.name.toUpperCase() })}
                </h3>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-gray-600 dark:text-gray-300 pt-1">
                <span>
                  <strong>{t('schoolKopClass')}</strong> {legerData.cohort.name}
                </span>
                <span>
                  <strong>{t('schoolKopYear')}</strong> {legerData.academicYear?.name || '-'}
                </span>
                <span>
                  <strong>{t('schoolKopKkm')}</strong> {legerData.school.passingGrade}
                </span>
                <span>
                  <strong>{t('schoolKopTotalStudents')}</strong> {t('studentsPersonUnit', { count: legerData.cohort.totalStudents })}
                </span>
              </div>
            </div>

            {/* Quick Metrics Bar (Non-print) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
                <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                  {t('kpiClassAverage')}
                </span>
                <p className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-0.5">
                  {legerData.overallClassAverage !== null ? legerData.overallClassAverage : '-'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
                <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  {t('kpiMasteryRate')}
                </span>
                <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mt-0.5">
                  {t('kkmPassedCount', { count: legerData.students.filter((s) => s.isPassed).length })}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  {t('remedialNeeded')}
                </span>
                <p className="text-xl font-bold text-amber-900 dark:text-amber-100 mt-0.5">
                  {t('remedialNeededCount', { count: legerData.students.filter((s) => !s.isPassed && s.averageScore !== null).length })}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50">
                <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                  {t('totalSubjects')}
                </span>
                <p className="text-xl font-bold text-purple-900 dark:text-purple-100 mt-0.5">
                  {t('subjectsCount', { count: legerData.subjects.length })}
                </p>
              </div>
            </div>

            {/* Leger Table Wrapper */}
            <div className="overflow-x-auto border border-gray-300 dark:border-gray-700 rounded-lg">
              <Table className="w-full text-xs print-table border-collapse">
                <TableHeader className="bg-gray-100 dark:bg-gray-800/80">
                  <TableRow className="border-b border-gray-300 dark:border-gray-700">
                    <TableHead rowSpan={2} className="w-10 text-center font-bold text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-700">
                      {t('colNo')}
                    </TableHead>
                    <TableHead rowSpan={2} className="w-24 font-bold text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-700">
                      {t('colNis')}
                    </TableHead>
                    <TableHead rowSpan={2} className="min-w-[180px] font-bold text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-700">
                      {t('colStudentName')}
                    </TableHead>

                    {/* Group Mata Pelajaran */}
                    {legerData.subjects.length > 0 ? (
                      <TableHead
                        colSpan={legerData.subjects.length}
                        className="text-center font-bold text-[#002446] dark:text-blue-300 border-r border-gray-300 dark:border-gray-700 bg-blue-50/50 dark:bg-blue-950/30"
                      >
                        {t('finalGradeHeader')}
                      </TableHead>
                    ) : (
                      <TableHead className="text-center font-bold text-gray-500 border-r border-gray-300 dark:border-gray-700">
                        {t('noCoursesConnected')}
                      </TableHead>
                    )}

                    <TableHead rowSpan={2} className="w-16 text-center font-bold text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-700">
                      {t('colTotalShort')}
                    </TableHead>
                    <TableHead rowSpan={2} className="w-16 text-center font-bold text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-700 bg-blue-50 dark:bg-blue-950/30">
                      {t('colAverageShort')}
                    </TableHead>
                    <TableHead rowSpan={2} className="w-14 text-center font-bold text-amber-700 dark:text-amber-400 border-r border-gray-300 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-950/20">
                      {t('colRankShort')}
                    </TableHead>

                    {/* Group Kehadiran */}
                    <TableHead colSpan={4} className="text-center font-bold text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-700 bg-emerald-50/50 dark:bg-emerald-950/20">
                      {t('attendanceHeader')}
                    </TableHead>

                    <TableHead rowSpan={2} className="w-24 text-center font-bold text-gray-900 dark:text-white">
                      {t('colStatusShort')}
                    </TableHead>
                  </TableRow>

                  {/* Sub-header Baris ke-2 */}
                  <TableRow className="border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    {/* Daftar Mapel */}
                    {legerData.subjects.map((sub) => (
                      <TableHead
                        key={sub.id}
                        className="text-center min-w-[90px] px-2 py-1 font-semibold text-gray-800 dark:text-gray-200 border-r border-gray-300 dark:border-gray-700"
                        title={`${sub.title} (${sub.teacherName})`}
                      >
                        <div className="truncate max-w-[110px] mx-auto">{sub.title}</div>
                      </TableHead>
                    ))}

                    {/* Sub-header Kehadiran H, S, I, A */}
                    <TableHead className="w-9 text-center font-bold text-emerald-700 dark:text-emerald-400 border-r border-gray-300 dark:border-gray-700">
                      H
                    </TableHead>
                    <TableHead className="w-9 text-center font-bold text-blue-700 dark:text-blue-400 border-r border-gray-300 dark:border-gray-700">
                      S
                    </TableHead>
                    <TableHead className="w-9 text-center font-bold text-amber-700 dark:text-amber-400 border-r border-gray-300 dark:border-gray-700">
                      I
                    </TableHead>
                    <TableHead className="w-9 text-center font-bold text-rose-700 dark:text-rose-400 border-r border-gray-300 dark:border-gray-700">
                      A
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8 + Math.max(legerData.subjects.length, 1)}
                        className="text-center py-8 text-gray-400 italic"
                      >
                        {t('noStudentsMatchingFilter')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map((st, idx) => {
                      const isRankTop3 = st.rank <= 3 && st.rank > 0;
                      return (
                        <TableRow
                          key={st.userId}
                          className="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 border-b border-gray-200 dark:border-gray-800"
                        >
                          <TableCell className="text-center font-medium border-r border-gray-200 dark:border-gray-800">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="font-mono text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-800">
                            {st.nis || '-'}
                          </TableCell>
                          <TableCell className="font-medium text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-800">
                            <div className="flex items-center gap-1.5">
                              {isRankTop3 && (
                                <Award className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                              )}
                              <span>{st.name}</span>
                            </div>
                          </TableCell>

                          {/* Nilai Tiap Mapel */}
                          {legerData.subjects.map((sub) => {
                            const score = st.subjectGrades[sub.id];
                            const isBelowPassing =
                              score !== null && score < legerData.school.passingGrade;
                            return (
                              <TableCell
                                key={sub.id}
                                className={`text-center font-medium border-r border-gray-200 dark:border-gray-800 ${
                                  isBelowPassing
                                    ? 'text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 font-bold'
                                    : 'text-gray-800 dark:text-gray-200'
                                }`}
                              >
                                {score !== null ? score : '-'}
                              </TableCell>
                            );
                          })}

                          {/* Total Nilai */}
                          <TableCell className="text-center font-bold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-800">
                            {st.totalScore}
                          </TableCell>

                          {/* Rata-rata */}
                          <TableCell
                            className={`text-center font-bold border-r border-gray-200 dark:border-gray-800 bg-blue-50/40 dark:bg-blue-950/20 ${
                              st.averageScore !== null &&
                              st.averageScore < legerData.school.passingGrade
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-[#002446] dark:text-blue-300'
                            }`}
                          >
                            {st.averageScore !== null ? st.averageScore : '-'}
                          </TableCell>

                          {/* Ranking */}
                          <TableCell className="text-center font-bold text-amber-800 dark:text-amber-300 border-r border-gray-200 dark:border-gray-800 bg-amber-50/40 dark:bg-amber-950/20">
                            {st.rank}
                          </TableCell>

                          {/* Presensi H, S, I, A */}
                          <TableCell className="text-center text-emerald-700 dark:text-emerald-400 border-r border-gray-200 dark:border-gray-800 font-medium">
                            {st.attendance.present}
                          </TableCell>
                          <TableCell className="text-center text-blue-700 dark:text-blue-400 border-r border-gray-200 dark:border-gray-800">
                            {st.attendance.sick}
                          </TableCell>
                          <TableCell className="text-center text-amber-700 dark:text-amber-400 border-r border-gray-200 dark:border-gray-800">
                            {st.attendance.permission}
                          </TableCell>
                          <TableCell className="text-center text-rose-700 dark:text-rose-400 border-r border-gray-200 dark:border-gray-800 font-bold">
                            {st.attendance.absent}
                          </TableCell>

                          {/* Status Kelulusan */}
                          <TableCell className="text-center">
                            {st.isPassed ? (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] px-1.5 py-0 border-none font-semibold">
                                {t('statusPassedBadge')}
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 text-[10px] px-1.5 py-0 border-none font-semibold">
                                {t('statusNotPassedBadge')}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}

                  {/* Baris Statistik Kelas */}
                  {filteredStudents.length > 0 && (
                    <>
                      {/* 1. Rata-rata Kelas */}
                      <TableRow className="bg-blue-50/60 dark:bg-blue-950/40 font-bold border-t-2 border-gray-400">
                        <TableCell colSpan={3} className="text-right pr-4 text-blue-950 dark:text-blue-200 uppercase tracking-wider border-r border-gray-300 dark:border-gray-700">
                          {t('summaryClassAverage')}
                        </TableCell>
                        {legerData.subjects.map((sub) => {
                          const stat = legerData.subjectStats[sub.id];
                          return (
                            <TableCell
                              key={sub.id}
                              className="text-center text-blue-900 dark:text-blue-200 border-r border-gray-300 dark:border-gray-700"
                            >
                              {stat?.average !== null && stat?.average !== undefined ? stat.average : '-'}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center border-r border-gray-300 dark:border-gray-700">
                          -
                        </TableCell>
                        <TableCell className="text-center text-blue-950 dark:text-blue-200 border-r border-gray-300 dark:border-gray-700">
                          {legerData.overallClassAverage !== null ? legerData.overallClassAverage : '-'}
                        </TableCell>
                        <TableCell colSpan={6} className="text-center text-gray-400">
                          -
                        </TableCell>
                      </TableRow>

                      {/* 2. Nilai Tertinggi */}
                      <TableRow className="bg-emerald-50/40 dark:bg-emerald-950/20 font-semibold">
                        <TableCell colSpan={3} className="text-right pr-4 text-emerald-900 dark:text-emerald-200 uppercase tracking-wider border-r border-gray-300 dark:border-gray-700">
                          {t('summaryHighest')}
                        </TableCell>
                        {legerData.subjects.map((sub) => {
                          const stat = legerData.subjectStats[sub.id];
                          return (
                            <TableCell
                              key={sub.id}
                              className="text-center text-emerald-800 dark:text-emerald-300 border-r border-gray-300 dark:border-gray-700"
                            >
                              {stat?.highest !== null && stat?.highest !== undefined ? stat.highest : '-'}
                            </TableCell>
                          );
                        })}
                        <TableCell colSpan={8} className="text-center text-gray-400">
                          -
                        </TableCell>
                      </TableRow>

                      {/* 3. Nilai Terendah */}
                      <TableRow className="bg-rose-50/40 dark:bg-rose-950/20 font-semibold">
                        <TableCell colSpan={3} className="text-right pr-4 text-rose-900 dark:text-rose-200 uppercase tracking-wider border-r border-gray-300 dark:border-gray-700">
                          {t('summaryLowest')}
                        </TableCell>
                        {legerData.subjects.map((sub) => {
                          const stat = legerData.subjectStats[sub.id];
                          return (
                            <TableCell
                              key={sub.id}
                              className="text-center text-rose-800 dark:text-rose-300 border-r border-gray-300 dark:border-gray-700"
                            >
                              {stat?.lowest !== null && stat?.lowest !== undefined ? stat.lowest : '-'}
                            </TableCell>
                          );
                        })}
                        <TableCell colSpan={8} className="text-center text-gray-400">
                          -
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Footer / Lembar Pengesahan Cetak */}
            <div className="pt-6 grid grid-cols-2 text-center text-xs text-gray-800 dark:text-gray-200">
              <div className="space-y-16">
                <p>{t('acknowledgement')}<br />{t('principal')}</p>
                <div>
                  <p className="font-bold underline">_________________________</p>
                  <p className="text-[11px] text-gray-500">NIP. -</p>
                </div>
              </div>
              <div className="space-y-16">
                <p>
                  {t('createdOn', { date: new Date().toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }) })}<br />
                  {t('homeroomTeacher')}
                </p>
                <div>
                  <p className="font-bold underline">
                    {legerData.cohort.homeroomTeacher?.name || '_________________________'}
                  </p>
                  <p className="text-[11px] text-gray-500">NIP. -</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-2 p-8 text-center text-gray-400">
          <GraduationCap className="w-12 h-12 mx-auto text-gray-300 mb-2" />
          <p className="font-medium text-gray-600 dark:text-gray-300">
            {cohorts.length === 0 ? t('notHomeroomTeacherTitle') : t('emptyCohortPrompt')}
          </p>
          <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
            {cohorts.length === 0 ? t('notHomeroomTeacherDesc') : t('emptyCohortPromptSub')}
          </p>
        </Card>
      )}
    </div>
  );
}