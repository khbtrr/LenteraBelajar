import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { AppLayout } from '@/components/layout/app-layout';
import { LayoutDashboard, BookOpen, Trophy, Medal, CalendarDays, MessageSquare } from 'lucide-react';

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
  const tPortal = await getTranslations('portal');
  const tRoles = await getTranslations('roles');

  let school = null;
  if (session.user.schoolId) {
    school = await db.school.findUnique({
      where: { id: session.user.schoolId },
      select: { name: true, logo: true },
    });
  }

  const sidebarItems = [
    { label: t('dashboard'), href: '/student/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: t('myCourses'), href: '/student/my-courses', icon: <BookOpen className="h-5 w-5" /> },
    { label: t('messages'), href: '/messages', icon: <MessageSquare className="h-5 w-5" /> },
    { label: t('grades'), href: '/student/grades', icon: <Trophy className="h-5 w-5" /> },
    { label: t('achievements'), href: '/student/achievements', icon: <Medal className="h-5 w-5" /> },
    { label: t('calendar'), href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
  ];

  return (
    <AppLayout
      items={sidebarItems}
      title={tPortal('studentTitle')}
      userName={session.user.name}
      userRole={tRoles('STUDENT')}
      schoolName={school?.name}
      schoolLogo={school?.logo}
    >
      {children}
    </AppLayout>
  );
}
