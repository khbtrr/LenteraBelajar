import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AppLayout } from '@/components/layout/app-layout';
import { LayoutDashboard, UserCheck, GraduationCap, FileBarChart, MessageSquare, ShieldCheck } from 'lucide-react';

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
    { label: 'Pesan', href: '/messages', icon: <MessageSquare className="h-5 w-5" /> },
    { label: 'Moderasi Pesan', href: '/admin/messages', icon: <ShieldCheck className="h-5 w-5" /> },
    { label: t('teacherActivity'), href: '/supervisor/teacher-activity', icon: <UserCheck className="h-5 w-5" /> },
    { label: t('studentActivity'), href: '/supervisor/student-activity', icon: <GraduationCap className="h-5 w-5" /> },
    { label: t('reports'), href: '/supervisor/reports', icon: <FileBarChart className="h-5 w-5" /> },
  ];

  return (
    <AppLayout
      items={sidebarItems}
      title="Monitoring Sekolah"
      userName={session.user.name}
      userRole="Kepsek/Wakasek"
    >
      {children}
    </AppLayout>
  );
}
