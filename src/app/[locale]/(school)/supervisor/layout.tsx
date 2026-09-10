import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { LayoutDashboard, UserCheck, GraduationCap, FileBarChart } from 'lucide-react';

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

  const sidebarItems = [
    { label: t('dashboard'), href: '/supervisor/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: t('teacherActivity'), href: '/supervisor/teacher-activity', icon: <UserCheck className="h-5 w-5" /> },
    { label: t('studentActivity'), href: '/supervisor/student-activity', icon: <GraduationCap className="h-5 w-5" /> },
    { label: t('reports'), href: '/supervisor/reports', icon: <FileBarChart className="h-5 w-5" /> },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar items={sidebarItems} title="Monitoring" />
      <div className="flex-1 flex flex-col">
        <Header userName={session.user.name} userRole="Kepsek/Wakasek" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
