import type { Metadata } from 'next';
import { getIndukSchool } from '@/lib/school';
import { LoginForm } from './login-form';

export async function generateMetadata(): Promise<Metadata> {
  const school = await getIndukSchool({
    name: true,
    logo: true,
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
  const school = await getIndukSchool({
    name: true,
    logo: true,
    loginQuote: true,
    loginQuoteAuthor: true,
  });

  return <LoginForm school={school} />;
}
