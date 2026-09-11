import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AppLayout } from '@/components/layout/app-layout';
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
    <AppLayout
      items={sidebarItems}
      title="Platform Admin"
      userName={session.user.name}
      userRole="Super Admin"
    >
      {children}
    </AppLayout>
  );
}
