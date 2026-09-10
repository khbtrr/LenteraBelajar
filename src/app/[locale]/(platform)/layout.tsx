import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { LayoutDashboard, School, Settings } from 'lucide-react';

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    redirect('/login');
  }

  const t = await getTranslations('sidebar');

  const sidebarItems = [
    { label: t('dashboard'), href: '/platform/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: t('schools'), href: '/platform/schools', icon: <School className="h-5 w-5" /> },
    { label: t('settings'), href: '/platform/settings', icon: <Settings className="h-5 w-5" /> },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar items={sidebarItems} title="LenteraBelajar" />
      <div className="flex-1 flex flex-col">
        <Header
          userName={session.user.name}
          userRole="Super Admin"
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
