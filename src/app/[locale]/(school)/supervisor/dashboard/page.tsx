import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getSupervisorDashboardData } from '@/lib/actions/supervisor-analytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import {
  Users,
  BookOpen,
  GraduationCap,
  UserCheck,
  Layers,
  Award,
  CalendarCheck,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileBarChart,
  ArrowUpRight,
} from 'lucide-react';

export default async function SupervisorDashboard() {
  const session = await auth();
  const t = await getTranslations('dashboard');
  const tSup = await getTranslations('supervisorDashboard');

  const data = await getSupervisorDashboardData();

  // Present/absent calculations
  const { cbtAnalytics, attendanceAnalytics, counts, topCourses, school } = data;

  const presentPercent = attendanceAnalytics.totalRecords > 0
    ? Math.round((attendanceAnalytics.present / attendanceAnalytics.totalRecords) * 100)
    : 0;
  const sickPercent = attendanceAnalytics.totalRecords > 0
    ? Math.round((attendanceAnalytics.sick / attendanceAnalytics.totalRecords) * 100)
    : 0;
  const permissionPercent = attendanceAnalytics.totalRecords > 0
    ? Math.round((attendanceAnalytics.permission / attendanceAnalytics.totalRecords) * 100)
    : 0;
  const absentPercent = attendanceAnalytics.totalRecords > 0
    ? Math.round((attendanceAnalytics.absent / attendanceAnalytics.totalRecords) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header Welcome */}
      <div className="bg-[#002446] rounded-2xl p-6 text-white relative overflow-hidden shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-sky-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {school.name}
              {data.academicYear && <span>• {data.academicYear.name}</span>}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t('welcome', { name: session?.user?.name || '' })}
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Portal Pemantauan Mutu Pembelajaran: Pantau keaktifan guru, ketercapaian nilai evaluasi CBT, serta tingkat kehadiran siswa.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/supervisor/reports">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs flex items-center gap-1.5"
              >
                <FileBarChart className="h-4 w-4" />
                {tSup('viewAllCourses')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Metrik Kartu Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t('totalTeachers')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <UserCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446] dark:text-white">{counts.teachers}</p>
            <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1">{tSup('teachersDesc')}</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t('totalStudents')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-[#FF8928] dark:text-amber-400 flex items-center justify-center">
              <GraduationCap className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446] dark:text-white">{counts.students}</p>
            <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1">{tSup('studentsDesc')}</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t('learningCourses')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <BookOpen className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446] dark:text-white">
              {counts.activeCourses}
              <span className="text-sm font-normal text-gray-500 dark:text-slate-400 ml-1.5">
                / {counts.courses}
              </span>
            </p>
            <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1">{tSup('activeCoursesDesc')}</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Bab Modul
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446] dark:text-white">{counts.modules}</p>
            <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1">{tSup('modulesDesc')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Baris 2: Analisis Evaluasi Nilai CBT & Presensi Kehadiran */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kolom Kiri: Evaluasi Pembelajaran CBT */}
        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-[#FF8928] dark:text-amber-400">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-[#002446] dark:text-white">
                    {tSup('cbtEvaluationTitle')}
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500 dark:text-slate-400">
                    {tSup('cbtEvaluationSubtitle')}
                  </CardDescription>
                </div>
              </div>

              <Badge variant="outline" className="text-xs font-bold border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40">
                {tSup('passingThreshold', { kkm: cbtAnalytics.passingThreshold })}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            {cbtAnalytics.completedAttempts === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-slate-500">
                {tSup('noCbtData')}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {/* Gauge Ringkasan Rata-rata */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                    <div className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                      {tSup('averageScore')}
                    </div>
                    <div className="text-3xl font-bold text-[#002446] dark:text-white">
                      {cbtAnalytics.averageScore}
                    </div>
                    <div className="text-[11px] text-gray-400 dark:text-slate-400">
                      {tSup('totalExamsTaken', { count: cbtAnalytics.completedAttempts })}
                    </div>
                  </div>

                  {/* Gauge Persentase Kelulusan */}
                  <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/50 space-y-1">
                    <div className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                      {tSup('passingRate')}
                    </div>
                    <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                      {cbtAnalytics.passingRate}%
                    </div>
                    <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {tSup('passedCount', { count: cbtAnalytics.passedCount })}
                    </div>
                  </div>
                </div>

                {/* Visual Progress Bar Kelulusan KKM */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-700 dark:text-slate-300">Tingkat Ketuntasan Siswa</span>
                    <span className="font-bold text-[#002446] dark:text-white">{cbtAnalytics.passingRate}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${cbtAnalytics.passingRate}%` }}
                      className="bg-emerald-500 transition-all duration-500 rounded-full"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    Proporsi ujian kuis siswa yang telah memenuhi atau melampaui nilai standar KKM ({cbtAnalytics.passingThreshold}).
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Kolom Kanan: Rekap Presensi & Kehadiran Siswa */}
        <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-[#002446] dark:text-white">
                    {tSup('attendanceTitle')}
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500 dark:text-slate-400">
                    {tSup('attendanceSubtitle')}
                  </CardDescription>
                </div>
              </div>

              <Badge variant="outline" className="text-xs font-bold border-blue-300 dark:border-blue-800/80 text-blue-900 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40">
                {attendanceAnalytics.attendanceRate}% {tSup('attendanceRate')}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            {attendanceAnalytics.totalRecords === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-slate-500">
                {tSup('noAttendanceData')}
              </div>
            ) : (
              <>
                {/* 4 Status Breakdown Cards */}
                <div className="grid grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/50 text-center">
                    <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                      {tSup('present')}
                    </div>
                    <div className="text-xl font-bold text-emerald-900 dark:text-emerald-200 mt-0.5">
                      {attendanceAnalytics.present}
                    </div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400">{presentPercent}%</div>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/50 text-center">
                    <div className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase">
                      {tSup('sick')}
                    </div>
                    <div className="text-xl font-bold text-blue-900 dark:text-blue-200 mt-0.5">
                      {attendanceAnalytics.sick}
                    </div>
                    <div className="text-[10px] text-blue-700 dark:text-blue-400">{sickPercent}%</div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 text-center">
                    <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase">
                      {tSup('permission')}
                    </div>
                    <div className="text-xl font-bold text-amber-900 dark:text-amber-200 mt-0.5">
                      {attendanceAnalytics.permission}
                    </div>
                    <div className="text-[10px] text-amber-700 dark:text-amber-400">{permissionPercent}%</div>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/50 text-center">
                    <div className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase">
                      {tSup('absent')}
                    </div>
                    <div className="text-xl font-bold text-rose-900 dark:text-rose-200 mt-0.5">
                      {attendanceAnalytics.absent}
                    </div>
                    <div className="text-[10px] text-rose-700 dark:text-rose-400">{absentPercent}%</div>
                  </div>
                </div>

                {/* Multi-segment Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="w-full h-3 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${presentPercent}%` }}
                      className="bg-emerald-500 transition-all duration-500"
                      title={`${tSup('present')}: ${presentPercent}%`}
                    />
                    <div
                      style={{ width: `${sickPercent}%` }}
                      className="bg-blue-500 transition-all duration-500"
                      title={`${tSup('sick')}: ${sickPercent}%`}
                    />
                    <div
                      style={{ width: `${permissionPercent}%` }}
                      className="bg-amber-500 transition-all duration-500"
                      title={`${tSup('permission')}: ${permissionPercent}%`}
                    />
                    <div
                      style={{ width: `${absentPercent}%` }}
                      className="bg-rose-500 transition-all duration-500"
                      title={`${tSup('absent')}: ${absentPercent}%`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-400 pt-0.5">
                    <span>{tSup('totalCheckins', { count: attendanceAnalytics.totalRecords })}</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {presentPercent}% {tSup('present')}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Baris 3: Tabel Mata Pelajaran Teraktif & Tinjau Modul */}
      <Card className="border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold text-[#002446] dark:text-white">
              {tSup('topCoursesTitle')}
            </CardTitle>
            <CardDescription className="text-xs text-gray-500 dark:text-slate-400">
              {tSup('topCoursesSubtitle')}
            </CardDescription>
          </div>

          <Link href="/supervisor/reports">
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-[#002446] dark:text-slate-200 border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1"
            >
              {tSup('viewAllCourses')}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700/60 text-gray-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">{tSup('colCourseTitle')}</th>
                  <th className="py-3 px-4">{tSup('colTeacher')}</th>
                  <th className="py-3 px-4 text-center">{tSup('colModules')}</th>
                  <th className="py-3 px-4 text-center">{tSup('colStudents')}</th>
                  <th className="py-3 px-4 text-center">{tSup('colAverageScore')}</th>
                  <th className="py-3 px-4 text-center">{tSup('colAction')}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {topCourses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400 dark:text-slate-500">
                      {tSup('noActiveCourses')}
                    </td>
                  </tr>
                ) : (
                  topCourses.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 dark:text-slate-100">{c.title}</div>
                        <div className="text-xs text-gray-400 dark:text-slate-400">{c.category}</div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-700 dark:text-slate-300 font-medium">
                        {c.teacherName}
                      </td>
                      <td className="py-3.5 px-4 text-center text-gray-700 dark:text-slate-300">
                        <span className="font-semibold text-gray-900 dark:text-slate-100">{c.modulesCount}</span> Bab
                      </td>
                      <td className="py-3.5 px-4 text-center text-gray-700 dark:text-slate-300">
                        {c.studentsCount}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {c.avgScore !== null ? (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              c.avgScore >= school.defaultPassingGrade
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-transparent dark:border-emerald-800/40'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-transparent dark:border-amber-800/40'
                            }`}
                          >
                            {c.avgScore}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Link href={`/teacher/course/${c.id}/modules`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-semibold border-[#002446]/20 dark:border-slate-700 text-[#002446] dark:text-slate-200 hover:bg-[#002446] dark:hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-1.5 mx-auto"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {tSup('inspectCourse')}
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
