import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { AppLayout } from '@/components/layout/app-layout';
import { LayoutDashboard, BookOpen, PlusCircle, CalendarDays, FileSpreadsheet, MessageSquare } from 'lucide-react';

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'TEACHER') {
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
    { label: t('dashboard'), href: '/teacher/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: t('myCourses'), href: '/teacher/my-courses', icon: <BookOpen className="h-5 w-5" /> },
    { label: t('messages'), href: '/messages', icon: <MessageSquare className="h-5 w-5" /> },
    { label: t('cohortGrades'), href: '/teacher/leger', icon: <FileSpreadsheet className="h-5 w-5" /> },
    { label: t('requestCourse'), href: '/teacher/request-course', icon: <PlusCircle className="h-5 w-5" /> },
    { label: t('calendar'), href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
  ];

  return (
    <AppLayout
      items={sidebarItems}
      title={tPortal('teacherTitle')}
      userName={session.user.name}
      userRole={tRoles('TEACHER')}
      schoolName={school?.name}
      schoolLogo={school?.logo}
    >
      {children}
    </AppLayout>
  );
}
