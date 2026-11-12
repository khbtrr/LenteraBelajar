'use client';

import { useSidebar } from '@/context/SidebarContext';
import { Sidebar, type SidebarItem } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { TourProvider } from '@/components/tour/tour-context';
import { AppTour } from '@/components/tour/app-tour';
import type { Role } from '@prisma/client';

interface AppLayoutProps {
  items: SidebarItem[];
  title: string;
  userName?: string | null;
  userRole: string;
  userAvatar?: string | null;
  schoolName?: string | null;
  schoolLogo?: string | null;
  role?: Role;
  tourCompleted?: boolean;
  children: React.ReactNode;
}

export function AppLayout({
  items,
  title,
  userName = 'User',
  userRole,
  userAvatar,
  schoolName,
  schoolLogo,
  role = 'STUDENT',
  tourCompleted = false,
  children,
}: AppLayoutProps) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  const isSidebarVisible = isExpanded || isHovered;
  const mainContentMargin = isMobileOpen
    ? 'ml-0'
    : isSidebarVisible
      ? 'lg:ml-[280px]'
      : 'lg:ml-[88px]';

  return (
    <TourProvider userRole={role} tourCompleted={tourCompleted}>
      <div data-lms-shell className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col lg:flex-row">
        {/* Responsive TailAdmin Sidebar */}
        <Sidebar
          items={items}
          title={title}
          schoolName={schoolName}
          schoolLogo={schoolLogo}
        />
        
        {/* Mobile Drawer Backdrop */}

        {/* Main Content Area */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${mainContentMargin}`}
        >
          <Header userName={userName ?? 'User'} userRole={userRole} userAvatar={userAvatar} />
          <main className="flex-1 p-4 md:p-6 lg:p-8 w-full max-w-(--breakpoint-2xl) mx-auto">
            {children}
          </main>
        </div>

        {/* First-time onboarding spotlight tour */}
        <AppTour />
      </div>
    </TourProvider>
  );
}
