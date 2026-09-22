import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { AppLayout } from '@/components/layout/app-layout';
import { LayoutDashboard, UserCheck, GraduationCap, FileBarChart, MessageSquare, CalendarDays } from 'lucide-react';

export default async function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'SUPERVISOR') {
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
    { label: t('dashboard'), href: '/supervisor/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: t('messages'), href: '/messages', icon: <MessageSquare className="h-5 w-5" /> },
    { label: t('teacherActivity'), href: '/supervisor/teacher-activity', icon: <UserCheck className="h-5 w-5" /> },
    { label: t('studentActivity'), href: '/supervisor/student-activity', icon: <GraduationCap className="h-5 w-5" /> },
    { label: t('reports'), href: '/supervisor/reports', icon: <FileBarChart className="h-5 w-5" /> },
    { label: t('calendar'), href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
  ];

  return (
    <AppLayout
      items={sidebarItems}
      title={tPortal('supervisorTitle')}
      userName={session.user.name}
      userRole={tRoles('SUPERVISOR')}
      schoolName={school?.name}
      schoolLogo={school?.logo}
    >
      {children}
    </AppLayout>
  );
}
