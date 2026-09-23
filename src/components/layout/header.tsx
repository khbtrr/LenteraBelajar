'use client';

import { useTranslations, useLocale } from 'next-intl';
import { LogOut, Menu, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { NotificationDropdown } from '@/components/layout/notification-dropdown';
import { ThemeToggleButton } from '@/components/common/ThemeToggleButton';
import { GamificationChip } from '@/components/layout/gamification-chip';
import { SchoolSwitcher } from '@/components/layout/school-switcher';
import { useSidebar } from '@/context/SidebarContext';
import { signOut } from 'next-auth/react';
import { Link } from '@/i18n/navigation';

interface HeaderProps {
  userName: string;
  userRole: string;
  userAvatar?: string | null;
  xp?: number;
  level?: number;
  streakDays?: number;
}

export function Header({
  userName,
  userRole,
  userAvatar,
  xp = 0,
  level = 1,
  streakDays = 0,
}: HeaderProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { isMobileOpen, toggleMobileSidebar, toggleSidebar } = useSidebar();

  const initials = (userName || 'User')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    await signOut({ callbackUrl: `/${locale}/login` });
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 md:px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 transition-colors">
      {/* Left side: Hamburger menu + mobile brand + School Switcher */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger toggle */}
        <button
          onClick={toggleMobileSidebar}
          aria-label="Toggle Mobile Menu"
          className="flex lg:hidden items-center justify-center w-10 h-10 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
        >
          {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Desktop Sidebar Toggle Button */}
        <button
          onClick={toggleSidebar}
          aria-label="Toggle Sidebar"
          className="hidden lg:flex items-center justify-center w-10 h-10 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile Brand Link */}
        <Link href="/" className="flex items-center gap-2 lg:hidden">
          <span className="font-bold text-base text-gray-900 dark:text-white">
            LenteraBelajar
          </span>
        </Link>

        {/* Multi-School Switcher */}
        <SchoolSwitcher />
      </div>

      {/* Right side: Tools, Switcher, Theme, Notifications & User */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Dark Mode Toggle */}
        <ThemeToggleButton />

        {/* Notification Dropdown */}
        <NotificationDropdown />

        {/* Gamification Streak & Level Chip (Students) */}
        <GamificationChip userRole={userRole} />

        <div className="h-6 w-[1px] bg-gray-200 dark:bg-gray-800 hidden sm:block mx-1" />

        {/* User Profile Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-3 px-2 py-1.5 h-auto rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Avatar className="h-9 w-9 border border-gray-200 dark:border-gray-700 shadow-xs">
                {userAvatar && <AvatarImage src={userAvatar} alt={userName} />}
                <AvatarFallback className="bg-brand-500 text-white font-semibold text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start leading-tight">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {userName}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {userRole}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 p-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-theme-lg"
          >
            <DropdownMenuLabel className="px-3 py-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {userName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                {userRole}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1 border-gray-100 dark:border-gray-800" />
            <DropdownMenuItem asChild>
              <Link
                href="/profile"
                className="cursor-pointer flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <User className="h-4 w-4 text-brand-500" />
                <span>{t('sidebar.profile')}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1 border-gray-100 dark:border-gray-800" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {t('auth.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
