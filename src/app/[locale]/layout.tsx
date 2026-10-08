import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Providers } from '@/components/providers';
import { db } from '@/lib/db';
import '@/app/globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const school = await db.school.findFirst({
    where: { isActive: true },
    select: { name: true, logo: true },
  });

  const appTitle = school?.name ? `${school.name} - LenteraBelajar` : 'LenteraBelajar';
  const iconUrl = school?.logo || '/favicon.ico';

  return {
    title: {
      default: appTitle,
      template: `%s - ${school?.name || 'LenteraBelajar'}`,
    },
    description: 'Learning Management System',
    icons: {
      icon: iconUrl,
      shortcut: iconUrl,
      apple: iconUrl,
    },
  };
}

interface RootLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: RootLayoutProps) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'id' | 'en')) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
