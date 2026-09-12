'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/context/ThemeContext';
import { SidebarProvider } from '@/context/SidebarContext';
import { DialogProvider } from '@/context/DialogContext';
import { type ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <SidebarProvider>
          <DialogProvider>
            {children}
          </DialogProvider>
        </SidebarProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
