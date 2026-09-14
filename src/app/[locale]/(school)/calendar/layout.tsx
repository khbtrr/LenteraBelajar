import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AppLayout } from '@/components/layout/app-layout';
import {
  LayoutDashboard,
  BookOpen,
  Trophy,
  Medal,
  PlusCircle,
  Calendar,
  CalendarDays,
  FolderTree,
  Users,
  UsersRound,
  FileCheck,
  Settings,
} from 'lucide-react';

export default async function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const t = await getTranslations('sidebar');
  const role = session.user.role;

  let title = 'Portal LenteraBelajar';
  let userRole = 'Pengguna';
  let sidebarItems: any[] = [];

  if (role === 'STUDENT') {
    title = 'Portal Siswa';
    userRole = 'Siswa';
    sidebarItems = [
      { label: t('dashboard'), href: '/student/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { label: t('myCourses'), href: '/student/my-courses', icon: <BookOpen className="h-5 w-5" /> },
      { label: t('grades'), href: '/student/grades', icon: <Trophy className="h-5 w-5" /> },
      { label: 'Prestasi & Lencana', href: '/student/achievements', icon: <Medal className="h-5 w-5" /> },
      { label: 'Kalender & Jadwal', href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
    ];
  } else if (role === 'TEACHER') {
    title = 'Portal Guru';
    userRole = 'Guru';
    sidebarItems = [
      { label: t('dashboard'), href: '/teacher/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { label: t('myCourses'), href: '/teacher/my-courses', icon: <BookOpen className="h-5 w-5" /> },
      { label: t('requestCourse'), href: '/teacher/request-course', icon: <PlusCircle className="h-5 w-5" /> },
      { label: 'Kalender & Jadwal', href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
    ];
  } else if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    title = 'Admin Sekolah';
    userRole = 'Administrator';
    sidebarItems = [
      { label: t('dashboard'), href: '/admin/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { label: t('academicYears'), href: '/admin/academic-years', icon: <Calendar className="h-5 w-5" /> },
      { label: t('categories'), href: '/admin/categories', icon: <FolderTree className="h-5 w-5" /> },
      { label: t('courses'), href: '/admin/courses', icon: <BookOpen className="h-5 w-5" /> },
      { label: t('cohorts'), href: '/admin/cohorts', icon: <UsersRound className="h-5 w-5" /> },
      { label: t('users'), href: '/admin/users', icon: <Users className="h-5 w-5" /> },
      { label: t('courseRequests'), href: '/admin/course-requests', icon: <FileCheck className="h-5 w-5" /> },
      { label: 'Kalender Akademik', href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
      { label: t('settings'), href: '/admin/settings', icon: <Settings className="h-5 w-5" /> },
    ];
  } else {
    // Supervisor
    title = 'Portal Pengawas';
    userRole = 'Pengawas';
    sidebarItems = [
      { label: 'Dashboard', href: '/supervisor/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { label: 'Laporan Belajar Siswa', href: '/supervisor/student-activity', icon: <Users className="h-5 w-5" /> },
      { label: 'Laporan Aktivitas Guru', href: '/supervisor/teacher-activity', icon: <BookOpen className="h-5 w-5" /> },
      { label: 'Kalender Akademik', href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
    ];
  }

  return (
    <AppLayout
      items={sidebarItems}
      title={title}
      userName={session.user.name}
      userRole={userRole}
    >
      {children}
    </AppLayout>
  );
}
