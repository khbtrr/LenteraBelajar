import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AppLayout } from '@/components/layout/app-layout';
import { LayoutDashboard, BookOpen, Trophy, Medal, CalendarDays } from 'lucide-react';

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'STUDENT') {
    redirect('/login');
  }

  const t = await getTranslations('sidebar');

  const sidebarItems = [
    { label: t('dashboard'), href: '/student/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: t('myCourses'), href: '/student/my-courses', icon: <BookOpen className="h-5 w-5" /> },
    { label: t('grades'), href: '/student/grades', icon: <Trophy className="h-5 w-5" /> },
    { label: 'Prestasi & Lencana', href: '/student/achievements', icon: <Medal className="h-5 w-5" /> },
    { label: 'Kalender & Jadwal', href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
  ];

  return (
    <AppLayout
      items={sidebarItems}
      title="Portal Siswa"
      userName={session.user.name}
      userRole="Siswa"
    >
      {children}
    </AppLayout>
  );
}
