import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { AppLayout } from '@/components/layout/app-layout';
import { LayoutDashboard, BookOpen, PlusCircle, CalendarDays, FileSpreadsheet } from 'lucide-react';

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
    { label: 'Leger Nilai Rombel', href: '/teacher/leger', icon: <FileSpreadsheet className="h-5 w-5" /> },
    { label: t('requestCourse'), href: '/teacher/request-course', icon: <PlusCircle className="h-5 w-5" /> },
    { label: 'Kalender & Jadwal', href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
  ];

  return (
    <AppLayout
      items={sidebarItems}
      title="Portal Guru"
      userName={session.user.name}
      userRole="Guru"
      schoolName={school?.name}
      schoolLogo={school?.logo}
    >
      {children}
    </AppLayout>
  );
}
