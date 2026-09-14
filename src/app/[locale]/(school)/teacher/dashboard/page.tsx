import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, ClipboardList, Users, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { MiniCalendarWidget } from '@/components/calendar/mini-calendar-widget';

export default async function TeacherDashboard() {
  const session = await auth();
  const t = await getTranslations('dashboard');

  if (!session?.user) return null;

  const [courseCount, activeCourseCount, studentCount, recentCourses] = await Promise.all([
    db.course.count({ where: { teacherId: session.user.id } }),
    db.course.count({ where: { teacherId: session.user.id, status: 'ACTIVE' } }),
    db.enrollment.count({ where: { course: { teacherId: session.user.id } } }),
    db.course.findMany({
      where: { teacherId: session.user.id },
      include: {
        category: { select: { name: true } },
        academicYear: { select: { name: true } },
        _count: { select: { enrollments: true, modules: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 4,
    }),
  ]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-linear-to-r from-[#002446] to-[#013567] text-white p-6 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#FF8928]" />
            <h1 className="text-2xl font-bold">
              {t('welcome', { name: session.user.name })}
            </h1>
          </div>
          <p className="text-xs text-white/80">
            Selamat datang di Portal Pendidik. Kelola materi, kuis, tugas, dan pantau kalender kegiatan belajar mengajar Anda.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/teacher/courses">
            <Button className="bg-[#FF8928] hover:bg-[#ff7b10] text-white font-bold text-xs">
              Kelola Kursus
            </Button>
          </Link>
          <Link href="/calendar">
            <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 font-medium text-xs">
              Buka Kalender
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('totalCourses')}
            </CardTitle>
            <BookOpen className="h-4 w-4 text-[#002446]" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446]">{courseCount}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Mata pelajaran yang Anda ampu</p>
          </CardContent>
        </Card>

        <Card className="bg-white border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('activeCourses')}
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">{activeCourseCount}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Status kelas sedang aktif</p>
          </CardContent>
        </Card>

        <Card className="bg-white border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('totalStudents')}
            </CardTitle>
            <Users className="h-4 w-4 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#FF8928]">{studentCount}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Siswa terdaftar di seluruh kelas</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Layout: Recent Courses (Left 2 cols) & Mini Calendar (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Recent Courses Section */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#002446]">Mata Pelajaran yang Diampu</h2>
            <Link href="/teacher/courses">
              <Button variant="ghost" size="sm" className="text-xs text-blue-700 hover:text-blue-900">
                Lihat Semua &rarr;
              </Button>
            </Link>
          </div>

          {recentCourses.length === 0 ? (
            <Card className="p-8 text-center text-gray-400">
              <BookOpen className="h-10 w-10 mx-auto text-gray-300 mb-2" />
              <p className="text-sm">Belum ada kelas atau mata pelajaran yang dibuat.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recentCourses.map((c) => (
                <Card key={c.id} className="hover:shadow-md transition-all border flex flex-col justify-between">
                  <CardHeader className="p-4 pb-2 space-y-1">
                    <span className="text-[11px] font-semibold text-[#FF8928] uppercase">
                      {c.category?.name || 'Mata Pelajaran'}
                    </span>
                    <CardTitle className="text-base font-bold text-[#002446] line-clamp-1">
                      {c.title}
                    </CardTitle>
                    <p className="text-xs text-gray-500">
                      Tahun Ajaran: <strong>{c.academicYear?.name || '-'}</strong>
                    </p>
                  </CardHeader>

                  <CardContent className="p-4 pt-0">
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t">
                      <span>{c._count.modules} Modul Materi</span>
                      <span>{c._count.enrollments} Siswa</span>
                    </div>
                  </CardContent>

                  <div className="p-4 pt-0">
                    <Link href={`/teacher/courses/${c.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs border-[#002446]/30 text-[#002446] hover:bg-[#002446] hover:text-white font-semibold flex items-center justify-center gap-1"
                      >
                        <span>Kelola Kelas</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Mini Calendar Widget */}
        <div className="space-y-4">
          <MiniCalendarWidget />
        </div>
      </div>
    </div>
  );
}
