import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { LoginForm } from './login-form';

export async function generateMetadata(): Promise<Metadata> {
  const school = await db.school.findFirst({
    where: { isActive: true },
    select: { name: true, logo: true },
  });

  const title = school?.name ? `Masuk - ${school.name}` : 'Masuk - LenteraBelajar';
  const iconUrl = school?.logo || '/favicon.ico';

  return {
    title,
    icons: {
      icon: iconUrl,
      shortcut: iconUrl,
      apple: iconUrl,
    },
  };
}

export default async function LoginPage() {
  const school = await db.school.findFirst({
    where: { isActive: true },
    select: {
      name: true,
      logo: true,
      loginQuote: true,
      loginQuoteAuthor: true,
    },
  });

  return <LoginForm school={school} />;
}
