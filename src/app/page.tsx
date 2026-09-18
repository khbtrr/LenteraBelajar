import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { routing } from '@/i18n/routing';

export default async function RootPage() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;

  if (cookieLocale && routing.locales.includes(cookieLocale as any)) {
    redirect(`/${cookieLocale}`);
  }

  const headerList = await headers();
  const acceptLang = headerList.get('accept-language') || '';
  const preferredLocale = acceptLang.toLowerCase().includes('en') ? 'en' : routing.defaultLocale;

  redirect(`/${preferredLocale}`);
}
