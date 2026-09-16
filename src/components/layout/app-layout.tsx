'use client';

import { useSidebar } from '@/context/SidebarContext';
import { Sidebar, type SidebarItem } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import Backdrop from '@/layout/Backdrop';

interface AppLayoutProps {
  items: SidebarItem[];
  title: string;
  userName?: string | null;
  userRole: string;
  schoolName?: string | null;
  schoolLogo?: string | null;
  children: React.ReactNode;
}

export function AppLayout({
  items,
  title,
  userName = 'User',
  userRole,
  schoolName,
  schoolLogo,
  children,
}: AppLayoutProps) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  const isSidebarVisible = isExpanded || isHovered;
  const mainContentMargin = isMobileOpen
    ? 'ml-0'
    : isSidebarVisible
      ? 'xl:ml-[280px]'
      : 'xl:ml-[88px]';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col xl:flex-row">
      {/* Responsive TailAdmin Sidebar */}
      <Sidebar
        items={items}
        title={title}
        schoolName={schoolName}
        schoolLogo={schoolLogo}
      />
      
      {/* Mobile Drawer Backdrop */}
      <Backdrop />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        <Header userName={userName ?? 'User'} userRole={userRole} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 w-full max-w-(--breakpoint-2xl) mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
