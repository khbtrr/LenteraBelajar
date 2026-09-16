import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { AppLayout } from '@/components/layout/app-layout';
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  FolderTree,
  BookOpen,
  Users,
  UsersRound,
  FileCheck,
  Megaphone,
  Settings,
  FileSpreadsheet,
} from 'lucide-react';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/login');
  }

  const t = await getTranslations('sidebar');

  let school = null;
  if (session.user.schoolId) {
    school = await db.school.findUnique({
      where: { id: session.user.schoolId },
      select: { name: true, logo: true },
    });
  }

  const sidebarItems = [
    { label: t('dashboard'), href: '/admin/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: 'Pengumuman Sekolah', href: '/admin/announcements', icon: <Megaphone className="h-5 w-5" /> },
    { label: t('academicYears'), href: '/admin/academic-years', icon: <Calendar className="h-5 w-5" /> },
    { label: t('categories'), href: '/admin/categories', icon: <FolderTree className="h-5 w-5" /> },
    { label: t('courses'), href: '/admin/courses', icon: <BookOpen className="h-5 w-5" /> },
    { label: t('cohorts'), href: '/admin/cohorts', icon: <UsersRound className="h-5 w-5" /> },
    { label: 'Leger & Rapor Rombel', href: '/admin/grades/leger', icon: <FileSpreadsheet className="h-5 w-5" /> },
    { label: t('users'), href: '/admin/users', icon: <Users className="h-5 w-5" /> },
    { label: t('courseRequests'), href: '/admin/course-requests', icon: <FileCheck className="h-5 w-5" /> },
    { label: 'Kalender Akademik', href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
    { label: t('settings'), href: '/admin/settings', icon: <Settings className="h-5 w-5" /> },
  ];

  return (
    <AppLayout
      items={sidebarItems}
      title="Admin Sekolah"
      userName={session.user.name}
      userRole="Administrator"
      schoolName={school?.name}
      schoolLogo={school?.logo}
    >
      {children}
    </AppLayout>
  );
}
