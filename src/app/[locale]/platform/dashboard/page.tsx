import { auth } from '@/lib/auth';
import { getPlatformDashboardStats } from '@/lib/actions/platform';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  School,
  Users,
  BookOpen,
  GraduationCap,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  Activity,
  Award,
} from 'lucide-react';

export default async function PlatformDashboard() {
  const session = await auth();
  const stats = await getPlatformDashboardStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">
          Dasbor Platform Admin
        </h1>
        <p className="text-sm text-gray-500">
          Selamat datang kembali, <span className="font-semibold text-gray-700">{session?.user?.name || 'Super Admin'}</span>. Berikut adalah ringkasan operasional seluruh tenant sekolah di platform LenteraBelajar.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Schools */}
        <Card className="border-l-4 border-l-[#002446] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Institusi Sekolah
            </CardTitle>
            <div className="p-2 bg-[#002446]/5 rounded-lg">
              <School className="h-5 w-5 text-[#002446]" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446]">{stats.schools.total}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span className="text-emerald-700 font-medium">{stats.schools.active} Aktif</span>
              <span>·</span>
              <span className="text-gray-500">{stats.schools.inactive} Non-Aktif</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Users */}
        <Card className="border-l-4 border-l-[#FF8928] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Pengguna
            </CardTitle>
            <div className="p-2 bg-[#FF8928]/10 rounded-lg">
              <Users className="h-5 w-5 text-[#FF8928]" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446]">{stats.users.total}</p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.users.students} Siswa · {stats.users.teachers} Guru
            </p>
          </CardContent>
        </Card>

        {/* Total Courses */}
        <Card className="border-l-4 border-l-sky-600 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Mata Pelajaran Aktif
            </CardTitle>
            <div className="p-2 bg-sky-50 rounded-lg">
              <BookOpen className="h-5 w-5 text-sky-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446]">{stats.learning.totalCourses}</p>
            <p className="text-xs text-gray-500 mt-1">
              Tersebar di {stats.schools.active} sekolah
            </p>
          </CardContent>
        </Card>

        {/* Learning Activities */}
        <Card className="border-l-4 border-l-emerald-600 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Aktivitas Pembelajaran
            </CardTitle>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Activity className="h-5 w-5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446]">
              {stats.learning.totalQuizAttempts + stats.learning.totalAssignmentSubmissions}
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span>{stats.learning.totalQuizAttempts} Ujian CBT</span>
              <span>·</span>
              <span>{stats.learning.totalAssignmentSubmissions} Tugas</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout: User Distribution & Recent Schools */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Distribution Card */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-[#002446] flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-[#FF8928]" />
              Komposisi Pengguna Platform
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <GraduationCap className="h-4 w-4 text-sky-600" /> Siswa
                </span>
                <span className="font-semibold text-gray-800">{stats.users.students}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-sky-600 h-2 rounded-full"
                  style={{
                    width: stats.users.total > 0 ? `${(stats.users.students / stats.users.total) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <BookOpen className="h-4 w-4 text-[#FF8928]" /> Guru
                </span>
                <span className="font-semibold text-gray-800">{stats.users.teachers}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-[#FF8928] h-2 rounded-full"
                  style={{
                    width: stats.users.total > 0 ? `${(stats.users.teachers / stats.users.total) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <ShieldAlert className="h-4 w-4 text-emerald-600" /> Administrator Sekolah
                </span>
                <span className="font-semibold text-gray-800">{stats.users.admins}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-emerald-600 h-2 rounded-full"
                  style={{
                    width: stats.users.total > 0 ? `${(stats.users.admins / stats.users.total) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <Award className="h-4 w-4 text-purple-600" /> Pengawas / Supervisor
                </span>
                <span className="font-semibold text-gray-800">{stats.users.supervisors}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{
                    width: stats.users.total > 0 ? `${(stats.users.supervisors / stats.users.total) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>

            <div className="pt-2 border-t flex justify-between items-center text-xs text-gray-500">
              <span>Super Admin Platform</span>
              <Badge variant="outline" className="font-mono text-xs">
                {stats.users.superAdmins} Akun
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Recent Schools Table Card */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-bold text-[#002446] flex items-center gap-2">
              <School className="h-4 w-4 text-[#002446]" />
              Institusi Sekolah Terbaru
            </CardTitle>
            <Link
              href="/platform/schools"
              className="text-xs font-semibold text-[#002446] hover:text-[#FF8928] flex items-center gap-1 transition-colors"
            >
              Lihat Semua Sekolah <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {stats.recentSchools.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  Belum ada sekolah yang terdaftar.
                </div>
              ) : (
                stats.recentSchools.map((school) => (
                  <div
                    key={school.id}
                    className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#002446]">
                          {school.name}
                        </span>
                        <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                          {school.code}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span>{school._count.users} Pengguna</span>
                        <span>·</span>
                        <span>{school._count.courses} Mata Pelajaran</span>
                        <span>·</span>
                        <span>
                          Terdaftar {new Date(school.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          school.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {school.isActive ? 'Aktif' : 'Non-Aktif'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
