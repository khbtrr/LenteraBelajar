import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { LayoutDashboard, BookOpen, Trophy } from 'lucide-react';

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
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar items={sidebarItems} title="Siswa" />
      <div className="flex-1 flex flex-col">
        <Header userName={session.user.name} userRole="Siswa" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
