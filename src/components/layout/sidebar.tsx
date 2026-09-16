'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useSidebar } from '@/context/SidebarContext';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from 'lucide-react';

export interface SidebarSubItem {
  label: string;
  href: string;
}

export interface SidebarItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  subItems?: SidebarSubItem[];
}

interface SidebarProps {
  items: SidebarItem[];
  title: string;
  schoolName?: string | null;
  schoolLogo?: string | null;
}

export function Sidebar({ items, title, schoolName, schoolLogo }: SidebarProps) {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  const isSidebarVisible = isExpanded || isHovered;

  const toggleSubmenu = (label: string) => {
    setOpenSubmenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'fixed top-0 left-0 z-50 h-screen flex flex-col',
        'bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800',
        'transition-all duration-300 ease-in-out',
        // Desktop width
        isSidebarVisible ? 'xl:w-[280px]' : 'xl:w-[88px]',
        // Mobile drawer positioning
        'w-[280px]',
        isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full xl:translate-x-0'
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white text-white shadow-sm flex-shrink-0 overflow-hidden border border-gray-100 dark:border-gray-800">
            {schoolLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={schoolLogo}
                alt={schoolName || 'Logo Sekolah'}
                className="w-8 h-8 object-contain"
              />
            ) : (
              <div className="w-full h-full bg-[#002446] flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
            )}
          </div>
          {isSidebarVisible && (
            <div className="flex flex-col min-w-0 transition-opacity duration-200">
              <span className="font-bold text-sm text-gray-900 dark:text-white truncate">
                {schoolName || 'LenteraBelajar'}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">
                {title}
              </span>
            </div>
          )}
        </Link>

        {/* Toggle Button for Desktop */}
        <button
          onClick={toggleSidebar}
          aria-label="Toggle Sidebar"
          className="hidden xl:flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
        >
          {isExpanded ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto no-scrollbar">
        <TooltipProvider delayDuration={150}>
          {items.map((item) => {
            const hasSub = item.subItems && item.subItems.length > 0;
            const isSubActive =
              hasSub && item.subItems?.some((sub) => pathname.includes(sub.href));
            const isActive = pathname.includes(item.href) || isSubActive;
            const isSubmenuOpen = openSubmenus[item.label] ?? isSubActive;

            if (hasSub) {
              return (
                <div key={item.label} className="space-y-1">
                  <button
                    onClick={() => toggleSubmenu(item.label)}
                    className={cn(
                      'menu-item group',
                      isActive ? 'menu-item-active' : 'menu-item-inactive'
                    )}
                  >
                    <span
                      className={cn(
                        'flex-shrink-0',
                        isActive ? 'menu-item-icon-active' : 'menu-item-icon'
                      )}
                    >
                      {item.icon}
                    </span>
                    {isSidebarVisible && (
                      <>
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 transition-transform duration-200',
                            isSubmenuOpen && 'rotate-180'
                          )}
                        />
                      </>
                    )}
                  </button>

                  {isSidebarVisible && isSubmenuOpen && (
                    <div className="pl-9 pr-2 py-1 space-y-1">
                      {item.subItems?.map((sub) => {
                        const isChildActive = pathname.includes(sub.href);
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={cn(
                              'block px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                              isChildActive
                                ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300 font-semibold'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                            )}
                          >
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const navLink = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'menu-item group',
                  isActive
                    ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300 font-semibold shadow-xs'
                    : 'menu-item-inactive'
                )}
              >
                <span
                  className={cn(
                    'flex-shrink-0',
                    isActive ? 'text-brand-500 dark:text-brand-400' : 'menu-item-icon'
                  )}
                >
                  {item.icon}
                </span>
                {isSidebarVisible && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}
                {item.badge && isSidebarVisible && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-accent-300 font-semibold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );

            if (!isSidebarVisible) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return navLink;
          })}
        </TooltipProvider>
      </nav>

      {/* Footer / User quick info if sidebar is visible */}
      {isSidebarVisible && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              LenteraBelajar LMS
            </span>
            <span className="text-[10px] uppercase tracking-wider font-bold text-brand-500 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-2 py-0.5 rounded-md">
              v1.0
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
