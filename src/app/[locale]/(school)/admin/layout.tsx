import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import {
  LayoutDashboard,
  Calendar,
  FolderTree,
  BookOpen,
  Users,
  UsersRound,
  FileCheck,
  Settings,
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

  const sidebarItems = [
    { label: t('dashboard'), href: '/admin/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: t('academicYears'), href: '/admin/academic-years', icon: <Calendar className="h-5 w-5" /> },
    { label: t('categories'), href: '/admin/categories', icon: <FolderTree className="h-5 w-5" /> },
    { label: t('courses'), href: '/admin/courses', icon: <BookOpen className="h-5 w-5" /> },
    { label: t('cohorts'), href: '/admin/cohorts', icon: <UsersRound className="h-5 w-5" /> },
    { label: t('users'), href: '/admin/users', icon: <Users className="h-5 w-5" /> },
    { label: t('courseRequests'), href: '/admin/course-requests', icon: <FileCheck className="h-5 w-5" /> },
    { label: t('settings'), href: '/admin/settings', icon: <Settings className="h-5 w-5" /> },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar items={sidebarItems} title="Admin" />
      <div className="flex-1 flex flex-col">
        <Header
          userName={session.user.name}
          userRole="Administrator"
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
