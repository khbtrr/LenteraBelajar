'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Role } from '@prisma/client';

export interface TourStepDefinition {
  id: string;
  targetSelector: string;
  fallbackSelector?: string;
  titleKey: string;
  descKey: string;
  placement?: 'bottom' | 'top' | 'right' | 'left';
}

interface TourContextValue {
  isOpen: boolean;
  currentStepIndex: number;
  totalSteps: number;
  currentStep: TourStepDefinition | null;
  userRole: Role;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  isDashboard: boolean;
}

const TourContext = createContext<TourContextValue | null>(null);

function getRoleDashboardPath(role: Role): string {
  switch (role) {
    case 'STUDENT':
      return '/student/dashboard';
    case 'TEACHER':
      return '/teacher/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    case 'SUPERVISOR':
      return '/supervisor/dashboard';
    case 'SUPER_ADMIN':
      return '/platform/dashboard';
    default:
      return '/';
  }
}

function getStepsForRole(role: Role): TourStepDefinition[] {
  const commonSteps: TourStepDefinition[] = [
    {
      id: 'sidebar',
      targetSelector: '[data-tour="sidebar"]',
      fallbackSelector: '#mobile-navigation-toggle',
      titleKey: 'sidebarTitle',
      descKey: 'sidebarDesc',
      placement: 'right',
    },
    {
      id: 'school-switcher',
      targetSelector: '[data-tour="school-switcher"]',
      titleKey: 'schoolSwitcherTitle',
      descKey: 'schoolSwitcherDesc',
      placement: 'bottom',
    },
    {
      id: 'header-controls',
      targetSelector: '[data-tour="header-controls"]',
      titleKey: 'headerControlsTitle',
      descKey: 'headerControlsDesc',
      placement: 'bottom',
    },
    {
      id: 'notifications',
      targetSelector: '[data-tour="notifications"]',
      titleKey: 'notificationsTitle',
      descKey: 'notificationsDesc',
      placement: 'bottom',
    },
    {
      id: 'user-profile',
      targetSelector: '[data-tour="user-profile"]',
      titleKey: 'userProfileTitle',
      descKey: 'userProfileDesc',
      placement: 'bottom',
    },
  ];

  let roleStep: TourStepDefinition;

  switch (role) {
    case 'STUDENT':
      roleStep = {
        id: 'role-focus',
        targetSelector: '[data-tour="role-dashboard-focus"]',
        titleKey: 'studentFocusTitle',
        descKey: 'studentFocusDesc',
        placement: 'bottom',
      };
      break;
    case 'TEACHER':
      roleStep = {
        id: 'role-focus',
        targetSelector: '[data-tour="role-dashboard-focus"]',
        titleKey: 'teacherFocusTitle',
        descKey: 'teacherFocusDesc',
        placement: 'bottom',
      };
      break;
    case 'ADMIN':
      roleStep = {
        id: 'role-focus',
        targetSelector: '[data-tour="role-dashboard-focus"]',
        titleKey: 'adminFocusTitle',
        descKey: 'adminFocusDesc',
        placement: 'bottom',
      };
      break;
    case 'SUPERVISOR':
      roleStep = {
        id: 'role-focus',
        targetSelector: '[data-tour="role-dashboard-focus"]',
        titleKey: 'supervisorFocusTitle',
        descKey: 'supervisorFocusDesc',
        placement: 'bottom',
      };
      break;
    case 'SUPER_ADMIN':
    default:
      roleStep = {
        id: 'role-focus',
        targetSelector: '[data-tour="role-dashboard-focus"]',
        titleKey: 'platformFocusTitle',
        descKey: 'platformFocusDesc',
        placement: 'bottom',
      };
      break;
  }

  // Common navigation elements first, then the role-specific dashboard focus
  return [...commonSteps, roleStep];
}

interface TourProviderProps {
  children: React.ReactNode;
  userRole?: Role;
  tourCompleted?: boolean;
}

export function TourProvider({
  children,
  userRole = 'STUDENT',
  tourCompleted = false,
}: TourProviderProps) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const searchParams = useSearchParams();

  const [hasCompleted, setHasCompleted] = useState<boolean>(Boolean(tourCompleted));
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  const steps = useMemo(() => getStepsForRole(userRole), [userRole]);

  // Determine if user is currently on their dashboard
  const isDashboard = useMemo(() => {
    const cleanPath = pathname.replace(/^\/(id|en)/, '');
    return (
      cleanPath === '/student/dashboard' ||
      cleanPath === '/teacher/dashboard' ||
      cleanPath === '/admin/dashboard' ||
      cleanPath === '/supervisor/dashboard' ||
      cleanPath === '/platform/dashboard'
    );
  }, [pathname]);

  const persistCompletion = useCallback(async () => {
    try {
      await fetch('/api/user/tour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      });
    } catch {
      // Best-effort network request
    }
  }, []);

  const startTour = useCallback(() => {
    if (!isDashboard) {
      const targetPath = getRoleDashboardPath(userRole);
      router.push(`${targetPath}?tour=start`);
      return;
    }
    setCurrentStepIndex(0);
    setIsOpen(true);
  }, [isDashboard, userRole, router]);

  const completeTour = useCallback(() => {
    setIsOpen(false);
    setHasCompleted(true);
    persistCompletion();
  }, [persistCompletion]);

  const skipTour = useCallback(() => {
    completeTour();
  }, [completeTour]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      completeTour();
    }
  }, [currentStepIndex, steps.length, completeTour]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  // Handle URL query parameter `?tour=start`
  useEffect(() => {
    if (isDashboard && searchParams?.get('tour') === 'start') {
      const timer = setTimeout(() => {
        setCurrentStepIndex(0);
        setIsOpen(true);
        // Clean query parameter from URL without page reload
        const newUrl = pathname;
        window.history.replaceState(null, '', newUrl);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isDashboard, searchParams, pathname]);

  // First-time user automatic tour prompt on dashboard
  useEffect(() => {
    if (isDashboard && !hasCompleted && !isOpen) {
      const timer = setTimeout(() => {
        setCurrentStepIndex(0);
        setIsOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isDashboard, hasCompleted, isOpen]);

  const currentStep = isOpen && steps[currentStepIndex] ? steps[currentStepIndex] : null;

  const value = useMemo<TourContextValue>(
    () => ({
      isOpen,
      currentStepIndex,
      totalSteps: steps.length,
      currentStep,
      userRole,
      startTour,
      nextStep,
      prevStep,
      skipTour,
      completeTour,
      isDashboard,
    }),
    [
      isOpen,
      currentStepIndex,
      steps.length,
      currentStep,
      userRole,
      startTour,
      nextStep,
      prevStep,
      skipTour,
      completeTour,
      isDashboard,
    ]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
